import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/community-plugins-admin/api/plugins';

interface HelmRelease {
  name: string;
  namespace: string;
  status: string;
}

interface HelmReleasesResponse {
  releases: HelmRelease[];
}

/**
 * Fetches the list of Helm releases installed across all namespaces from the BFF.
 * This is used to detect plugins that are "installed but disabled" — they have a Helm
 * release (so `helmInstalledNames` includes them) but are absent from
 * MODULE_FEDERATION_CONFIG (so `installedNames` does not include them).
 */
export function useHelmReleasedPlugins() {
  const [helmInstalledNames, setHelmInstalledNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(API_BASE, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch Helm releases: ${res.status}`);
        return res.json() as Promise<HelmReleasesResponse>;
      })
      .then((data) => {
        const names = new Set(data.releases.map((r) => r.name));
        setHelmInstalledNames(names);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setHelmInstalledNames(new Set());
        setLoading(false);
      });

    return () => controller.abort();
  }, [fetchCount]);

  const refetch = useCallback(() => setFetchCount((c) => c + 1), []);

  return { helmInstalledNames, loading, error, refetch };
}
