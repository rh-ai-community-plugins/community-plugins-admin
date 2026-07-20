import { useState, useEffect } from 'react';
import { CatalogPlugin } from '~/app/types/catalog';

export interface PluginDetailResult {
  plugin: CatalogPlugin | null;
  installed: boolean;
  loading: boolean;
  error: string | null;
}

export function usePluginDetail(
  pluginName: string | null,
  installedNames: Set<string>,
  installedLoading: boolean,
): PluginDetailResult {
  const [plugin, setPlugin] = useState<CatalogPlugin | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pluginName) {
      setPlugin(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setPlugin(null);
    setLoading(true);
    setError(null);

    fetch(`/community-plugins-admin/api/catalog/${encodeURIComponent(pluginName)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (res.status === 404) {
          throw new Error(`Plugin "${pluginName}" not found`);
        }
        if (!res.ok) {
          throw new Error(`Failed to fetch plugin details: ${res.status}`);
        }
        return res.json();
      })
      .then((data: CatalogPlugin) => {
        setPlugin(data);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setPlugin(null);
        setLoading(false);
      });

    return () => controller.abort();
  }, [pluginName]);

  const installed = pluginName ? installedNames.has(pluginName) : false;

  return {
    plugin,
    installed,
    loading: !error && (loading || (!!pluginName && installedLoading)),
    error,
  };
}
