import { useState, useEffect, useCallback } from 'react';
import { CatalogPlugin, CatalogResponse } from '~/app/types/catalog';

export function useCatalog() {
  const [plugins, setPlugins] = useState<CatalogPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const url =
      fetchCount > 0
        ? '/community-plugins-admin/api/catalog?refresh=true'
        : '/community-plugins-admin/api/catalog';

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch catalog: ${res.status}`);
        return res.json();
      })
      .then((data: CatalogResponse) => {
        if (!Array.isArray(data.plugins)) {
          throw new Error('Invalid catalog response');
        }
        setPlugins(data.plugins);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((c) => c + 1);
  }, []);

  return { plugins, loading, error, refetch };
}
