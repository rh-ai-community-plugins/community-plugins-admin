import { useState, useCallback } from 'react';
import { LifecycleResponse, LifecycleOperation } from '~/app/types/lifecycle';

const API_BASE = '/community-plugins-admin/api/plugins';

interface PluginLifecycleState {
  loading: boolean;
  operation: LifecycleOperation | null;
  result: LifecycleResponse | null;
  error: string | null;
}

export interface PluginLifecycleActions {
  install: (pluginName: string, namespace?: string, values?: Record<string, unknown>) => Promise<LifecycleResponse>;
  upgrade: (pluginName: string, values?: Record<string, unknown>) => Promise<LifecycleResponse>;
  remove: (pluginName: string, deleteNamespace?: boolean) => Promise<LifecycleResponse>;
  enable: (pluginName: string) => Promise<LifecycleResponse>;
  disable: (pluginName: string) => Promise<LifecycleResponse>;
  reset: () => void;
}

async function lifecycleRequest(
  url: string,
  method: 'POST' | 'DELETE',
  body?: unknown,
): Promise<LifecycleResponse> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data: LifecycleResponse = await res.json();
  return data;
}

export function usePluginLifecycle(): PluginLifecycleState & PluginLifecycleActions {
  const [state, setState] = useState<PluginLifecycleState>({
    loading: false,
    operation: null,
    result: null,
    error: null,
  });

  const execute = useCallback(
    async (
      operation: LifecycleOperation,
      fn: () => Promise<LifecycleResponse>,
    ): Promise<LifecycleResponse> => {
      setState({ loading: true, operation, result: null, error: null });
      try {
        const result = await fn();
        setState({ loading: false, operation, result, error: result.success ? null : result.message });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        const failedResult: LifecycleResponse = {
          success: false,
          message,
          steps: [],
        };
        setState({ loading: false, operation, result: failedResult, error: message });
        return failedResult;
      }
    },
    [],
  );

  const install = useCallback(
    (pluginName: string, namespace?: string, values?: Record<string, unknown>) =>
      execute('install', () =>
        lifecycleRequest(
          `${API_BASE}/${encodeURIComponent(pluginName)}/install`,
          'POST',
          { namespace, values },
        ),
      ),
    [execute],
  );

  const upgrade = useCallback(
    (pluginName: string, values?: Record<string, unknown>) =>
      execute('upgrade', () =>
        lifecycleRequest(
          `${API_BASE}/${encodeURIComponent(pluginName)}/upgrade`,
          'POST',
          values ? { values } : undefined,
        ),
      ),
    [execute],
  );

  const remove = useCallback(
    (pluginName: string, deleteNamespace?: boolean) =>
      execute('remove', () =>
        lifecycleRequest(
          `${API_BASE}/${encodeURIComponent(pluginName)}${deleteNamespace ? '?deleteNamespace=true' : ''}`,
          'DELETE',
        ),
      ),
    [execute],
  );

  const enable = useCallback(
    (pluginName: string) =>
      execute('enable', () =>
        lifecycleRequest(
          `${API_BASE}/${encodeURIComponent(pluginName)}/enable`,
          'POST',
        ),
      ),
    [execute],
  );

  const disable = useCallback(
    (pluginName: string) =>
      execute('disable', () =>
        lifecycleRequest(
          `${API_BASE}/${encodeURIComponent(pluginName)}/disable`,
          'POST',
        ),
      ),
    [execute],
  );

  const reset = useCallback(() => {
    setState({ loading: false, operation: null, result: null, error: null });
  }, []);

  return { ...state, install, upgrade, remove, enable, disable, reset };
}
