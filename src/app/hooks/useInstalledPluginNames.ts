import { useState, useEffect } from 'react';

import { ModuleFederationEntry } from '~/app/types/installed';

export { type ModuleFederationEntry } from '~/app/types/installed';

const DASHBOARD_NAMESPACE = 'redhat-ods-applications';
const DASHBOARD_DEPLOYMENT = 'rhods-dashboard';

/**
 * Converts a camelCase Module Federation scope to kebab-case so it can be
 * matched against the charter registry's kebab-case plugin names.
 * e.g. "communityPluginsAdmin" → "community-plugins-admin"
 */
export const scopeToKebab = (scope: string): string =>
  scope.replace(/([A-Z])/g, '-$1').toLowerCase();

export function useInstalledPluginNames() {
  const [installedNames, setInstalledNames] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<ModuleFederationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(
      `/api/k8s/apis/apps/v1/namespaces/${DASHBOARD_NAMESPACE}/deployments/${DASHBOARD_DEPLOYMENT}`,
      { signal: controller.signal },
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
              const mfEntries = parsed as ModuleFederationEntry[];
              setEntries(mfEntries);
              setInstalledNames(new Set(mfEntries.map((e) => scopeToKebab(e.scope))));
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
  }, []);

  return { installedNames, entries, loading, error };
}
