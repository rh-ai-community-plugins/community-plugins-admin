import { useState, useEffect, useMemo } from 'react';
import { useInstalledPluginNames, scopeToKebab } from '~/app/hooks/useInstalledPluginNames';
import { useCatalog } from '~/app/hooks/useCatalog';
import { InstalledPlugin, PluginHealthStatus } from '~/app/types/installed';

export function parseRemoteEntryUrl(remoteEntry: string): { namespace: string; service: string } | null {
  try {
    const url = new URL(remoteEntry);
    const hostParts = url.hostname.split('.');
    if (hostParts.length >= 2 && hostParts[hostParts.length - 1] === 'local') {
      return { service: hostParts[0], namespace: hostParts[1] };
    }
  } catch {
    // not a valid URL
  }
  return null;
}

function deriveHealthStatus(deployment: {
  status?: {
    replicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
    unavailableReplicas?: number;
  };
  spec?: { replicas?: number };
}): { healthStatus: PluginHealthStatus; availableReplicas: number; desiredReplicas: number } {
  const desired = deployment.spec?.replicas ?? 0;
  const available = deployment.status?.availableReplicas ?? 0;

  if (desired === 0) {
    return { healthStatus: 'stopped', availableReplicas: 0, desiredReplicas: 0 };
  }
  if (available >= desired) {
    return { healthStatus: 'running', availableReplicas: available, desiredReplicas: desired };
  }
  if (available > 0) {
    return { healthStatus: 'degraded', availableReplicas: available, desiredReplicas: desired };
  }
  return { healthStatus: 'stopped', availableReplicas: 0, desiredReplicas: desired };
}

async function fetchDeploymentHealth(
  namespace: string,
  service: string,
  signal: AbortSignal,
): Promise<{ healthStatus: PluginHealthStatus; availableReplicas?: number; desiredReplicas?: number }> {
  try {
    const res = await fetch(
      `/api/k8s/apis/apps/v1/namespaces/${namespace}/deployments/${service}`,
      { signal },
    );
    if (!res.ok) {
      return { healthStatus: 'unknown' };
    }
    const deployment = await res.json();
    return deriveHealthStatus(deployment);
  } catch {
    return { healthStatus: 'unknown' };
  }
}

export function useInstalledPlugins() {
  const {
    entries,
    loading: namesLoading,
    error: namesError,
  } = useInstalledPluginNames();

  const {
    plugins: catalogPlugins,
    loading: catalogLoading,
    isRefetching: catalogRefetching,
    error: catalogError,
    refetch: catalogRefetch,
  } = useCatalog();

  const [healthMap, setHealthMap] = useState<
    Map<string, { healthStatus: PluginHealthStatus; availableReplicas?: number; desiredReplicas?: number }>
  >(new Map());
  const [healthLoading, setHealthLoading] = useState(false);

  useEffect(() => {
    if (namesLoading || entries.length === 0) return;

    const controller = new AbortController();
    setHealthLoading(true);

    const checks = entries.map(async (entry) => {
      const name = scopeToKebab(entry.scope);
      const parsed = parseRemoteEntryUrl(entry.remoteEntry);
      if (!parsed) {
        return { name, healthStatus: 'unknown' as PluginHealthStatus };
      }
      const result = await fetchDeploymentHealth(parsed.namespace, parsed.service, controller.signal);
      return { name, ...result };
    });

    Promise.all(checks)
      .then((results) => {
        const map = new Map<string, { healthStatus: PluginHealthStatus; availableReplicas?: number; desiredReplicas?: number }>();
        for (const r of results) {
          map.set(r.name, {
            healthStatus: r.healthStatus,
            availableReplicas: r.availableReplicas,
            desiredReplicas: r.desiredReplicas,
          });
        }
        setHealthMap(map);
        setHealthLoading(false);
      })
      .catch(() => {
        setHealthLoading(false);
      });

    return () => controller.abort();
  }, [namesLoading, entries]);

  const installedPlugins: InstalledPlugin[] = useMemo(() => {
    if (namesLoading) return [];

    const catalogByName = new Map(catalogPlugins.map((p) => [p.name, p]));

    return entries.map((entry) => {
      const name = scopeToKebab(entry.scope);
      const health = healthMap.get(name);
      return {
        name,
        scope: entry.scope,
        module: entry.module,
        remoteEntry: entry.remoteEntry,
        enabled: true,
        healthStatus: health?.healthStatus ?? 'unknown',
        availableReplicas: health?.availableReplicas,
        desiredReplicas: health?.desiredReplicas,
        catalogPlugin: catalogByName.get(name),
      };
    });
  }, [namesLoading, entries, catalogPlugins, healthMap]);

  const loading = namesLoading || catalogLoading;
  const error = namesError ?? catalogError ?? null;

  return {
    plugins: installedPlugins,
    loading,
    healthLoading,
    isRefetching: catalogRefetching,
    error,
    catalogError,
    refetch: catalogRefetch,
  };
}
