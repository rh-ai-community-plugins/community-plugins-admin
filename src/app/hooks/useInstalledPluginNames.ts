import { useState, useEffect, useCallback } from 'react';

import { ModuleFederationEntry } from '~/app/types/installed';

export const scopeToKebab = (scope: string): string =>
  scope.replace(/([A-Z])/g, '-$1').toLowerCase();

function isModuleFederationEntry(value: unknown): value is ModuleFederationEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).name === 'string'
  );
}

function extractServiceInfo(entry: ModuleFederationEntry): { namespace: string; service: string } | null {
  const backend = entry.backend as { service?: { name?: string; namespace?: string } } | undefined;
  if (backend?.service?.name && backend?.service?.namespace) {
    return { service: backend.service.name, namespace: backend.service.namespace };
  }

  const flatService = entry.service as { name?: string; namespace?: string } | undefined;
  if (flatService?.name && flatService?.namespace) {
    return { service: flatService.name, namespace: flatService.namespace };
  }

  const remoteEntry = (entry.remoteEntry ?? (backend as { remoteEntry?: string })?.remoteEntry) as string | undefined;
  if (remoteEntry) {
    try {
      const url = new URL(remoteEntry);
      const hostParts = url.hostname.split('.');
      if (hostParts.length >= 5 && hostParts.slice(-3).join('.') === 'svc.cluster.local') {
        return { service: hostParts[0], namespace: hostParts[1] };
      }
    } catch {
      // not a valid URL
    }
  }

  return null;
}

export { extractServiceInfo };

export function useInstalledPluginNames() {
  const [installedNames, setInstalledNames] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<ModuleFederationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/community-plugins-admin/api/config', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch BFF config: ${res.status}`);
        return res.json();
      })
      .then(({ dashboardNamespace, dashboardDeployment }) =>
        fetch(
          `/api/k8s/apis/apps/v1/namespaces/${dashboardNamespace}/deployments/${dashboardDeployment}`,
          { signal: controller.signal },
        ),
      )
      .then((res) => {
        if (!res.ok)
          throw new Error(
            `Failed to fetch dashboard deployment: ${res.status}`,
          );
        return res.json();
      })
      .then((deployment) => {
        const containers =
          deployment.spec?.template?.spec?.containers ?? [];
        for (const container of containers) {
          const envVars = container.env ?? [];
          const mfConfig = envVars.find(
            (e: { name: string }) =>
              e.name === 'MODULE_FEDERATION_CONFIG',
          );
          if (mfConfig?.value) {
            try {
              const parsed: unknown = JSON.parse(mfConfig.value);
              if (!Array.isArray(parsed)) {
                throw new Error(
                  `MODULE_FEDERATION_CONFIG is not an array (got ${typeof parsed})`,
                );
              }
              const mfEntries = parsed.filter(isModuleFederationEntry);
              setEntries(mfEntries);
              setInstalledNames(new Set(mfEntries.map((e) => scopeToKebab(e.name))));
            } catch (parseErr) {
              setError(
                parseErr instanceof Error
                  ? parseErr.message
                  : String(parseErr),
              );
              setEntries([]);
              setInstalledNames(new Set());
            }
            setLoading(false);
            return;
          }
        }
        setEntries([]);
        setInstalledNames(new Set());
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setEntries([]);
        setInstalledNames(new Set());
        setLoading(false);
      });

    return () => controller.abort();
  }, [fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((c) => c + 1);
  }, []);

  return { installedNames, entries, loading, error, refetch };
}
