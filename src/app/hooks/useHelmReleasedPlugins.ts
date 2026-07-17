import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/community-plugins-admin/api/plugins';

interface HelmRelease {
  name: string;
  namespace: string;
  status: string;
  app_version?: string;
}

interface HelmReleasesResponse {
  releases: HelmRelease[];
}

export function useHelmReleasedPlugins() {
  const [helmInstalledNames, setHelmInstalledNames] = useState<Set<string>>(new Set());
  const [helmVersionMap, setHelmVersionMap] = useState<Map<string, string>>(new Map());
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
        const versions = new Map<string, string>();
        for (const r of data.releases) {
          if (r.app_version) {
            versions.set(r.name, r.app_version);
          }
        }
        setHelmInstalledNames(names);
        setHelmVersionMap(versions);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setHelmInstalledNames(new Set());
        setHelmVersionMap(new Map());
        setLoading(false);
      });

    return () => controller.abort();
  }, [fetchCount]);

  const refetch = useCallback(() => setFetchCount((c) => c + 1), []);

  return { helmInstalledNames, helmVersionMap, loading, error, refetch };
}
