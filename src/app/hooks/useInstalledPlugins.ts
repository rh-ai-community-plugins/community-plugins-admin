import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useInstalledPluginNames, scopeToKebab, extractServiceInfo } from '~/app/hooks/useInstalledPluginNames';
import { useCatalog } from '~/app/hooks/useCatalog';
import { useHelmReleasedPlugins } from '~/app/hooks/useHelmReleasedPlugins';
import { InstalledPlugin, ModuleFederationEntry, PluginHealthStatus } from '~/app/types/installed';

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
      if (res.status === 404) {
        console.warn(
          `Deployment "${service}" not found in namespace "${namespace}". ` +
          `Health check assumes the Deployment name matches the Service name.`,
        );
      }
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
    refetch: namesRefetch,
  } = useInstalledPluginNames();

  const {
    plugins: catalogPlugins,
    loading: catalogLoading,
    isRefetching: catalogRefetching,
    error: catalogError,
    refetch: catalogRefetch,
  } = useCatalog();

  const {
    helmVersionMap,
    loading: helmLoading,
    refetch: helmRefetch,
  } = useHelmReleasedPlugins();

  const [healthMap, setHealthMap] = useState<
    Map<string, { healthStatus: PluginHealthStatus; availableReplicas?: number; desiredReplicas?: number }>
  >(new Map());
  const [healthLoading, setHealthLoading] = useState(false);

  const entriesRef = useRef<ModuleFederationEntry[]>([]);
  const entriesKey = useMemo(() => entries.map((e) => e.name).join(','), [entries]);
  entriesRef.current = entries;

  useEffect(() => {
    const currentEntries = entriesRef.current;
    if (namesLoading || currentEntries.length === 0) {
      setHealthLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setHealthLoading(true);

    const checks = currentEntries.map(async (entry) => {
      const name = scopeToKebab(entry.name);
      const svcInfo = extractServiceInfo(entry);
      if (!svcInfo) {
        return { name, healthStatus: 'unknown' as PluginHealthStatus };
      }
      const result = await fetchDeploymentHealth(svcInfo.namespace, svcInfo.service, controller.signal);
      return { name, ...result };
    });

    Promise.all(checks)
      .then((results) => {
        if (cancelled) return;
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
        if (cancelled) return;
        setHealthLoading(false);
      });

    return () => { cancelled = true; controller.abort(); };
  }, [namesLoading, entriesKey]);

  const catalogByName = useMemo(
    () => new Map(catalogPlugins.map((p) => [p.name, p])),
    [catalogPlugins],
  );

  const installedPlugins: InstalledPlugin[] = useMemo(() => {
    if (namesLoading) return [];

    return entries.map((entry) => {
      const name = scopeToKebab(entry.name);
      const health = healthMap.get(name);
      return {
        name,
        mfName: entry.name,
        enabled: true,
        healthStatus: health?.healthStatus ?? 'unknown',
        availableReplicas: health?.availableReplicas,
        desiredReplicas: health?.desiredReplicas,
        installedVersion: helmVersionMap.get(name),
        catalogPlugin: catalogByName.get(name),
      };
    });
  }, [namesLoading, entries, catalogByName, healthMap, helmVersionMap]);

  const loading = namesLoading || catalogLoading || helmLoading;
  const error = namesError ?? null;

  const refetch = useCallback(() => {
    namesRefetch();
    catalogRefetch();
    helmRefetch();
  }, [namesRefetch, catalogRefetch, helmRefetch]);

  return {
    plugins: installedPlugins,
    loading,
    healthLoading,
    isRefetching: catalogRefetching,
    error,
    catalogError,
    helmVersionMap,
    refetch,
  };
}
