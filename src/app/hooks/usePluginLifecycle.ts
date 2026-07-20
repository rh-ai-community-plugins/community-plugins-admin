import { useState, useCallback } from 'react';
import { LifecycleResponse, LifecycleStep, LifecycleOperation, LifecycleProgressEvent } from '~/app/types/lifecycle';

const API_BASE = '/community-plugins-admin/api/plugins';

export interface PluginLifecycleState {
  loading: boolean;
  operation: LifecycleOperation | null;
  steps: LifecycleStep[];
  result: LifecycleResponse | null;
  error: string | null;
}

/** Combined type returned by usePluginLifecycle and accepted as a prop by PluginDetailModal. */
export type PluginLifecycle = PluginLifecycleState & PluginLifecycleActions;

export interface PluginLifecycleActions {
  install: (pluginName: string, namespace?: string, values?: Record<string, unknown>) => Promise<LifecycleResponse>;
  upgrade: (pluginName: string, values?: Record<string, unknown>) => Promise<LifecycleResponse>;
  remove: (pluginName: string, deleteNamespace?: boolean) => Promise<LifecycleResponse>;
  enable: (pluginName: string) => Promise<LifecycleResponse>;
  disable: (pluginName: string) => Promise<LifecycleResponse>;
  reset: () => void;
}

async function lifecycleStreamRequest(
  url: string,
  method: 'POST' | 'DELETE',
  onProgress: (steps: LifecycleStep[]) => void,
  body?: unknown,
): Promise<LifecycleResponse> {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const contentType = res.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const data: LifecycleResponse = await res.json();
    return data;
  }

  if (!res.body) {
    throw new Error('Response body is not readable');
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let finalResult: LifecycleResponse | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += value;
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      if (!part.trim()) continue;

      let eventType = 'message';
      let data = '';

      for (const line of part.split('\n')) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7);
        } else if (line.startsWith('data: ')) {
          data = line.slice(6);
        }
      }

      if (!data) continue;

      if (eventType === 'progress') {
        const parsed: LifecycleProgressEvent = JSON.parse(data);
        onProgress(parsed.steps);
      } else if (eventType === 'complete') {
        finalResult = JSON.parse(data) as LifecycleResponse;
      }
    }
  }

  if (!finalResult) {
    throw new Error('Stream ended without a complete event');
  }

  return finalResult;
}

export function usePluginLifecycle(): PluginLifecycle {
  const [state, setState] = useState<PluginLifecycleState>({
    loading: false,
    operation: null,
    steps: [],
    result: null,
    error: null,
  });

  const execute = useCallback(
    async (
      operation: LifecycleOperation,
      requestFn: (onProgress: (steps: LifecycleStep[]) => void) => Promise<LifecycleResponse>,
    ): Promise<LifecycleResponse> => {
      setState({ loading: true, operation, steps: [], result: null, error: null });
      try {
        const result = await requestFn((steps) => {
          setState((prev) => ({ ...prev, steps: [...steps] }));
        });
        setState({
          loading: false, operation, steps: result.steps,
          result, error: result.success ? null : result.message,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        const failedResult: LifecycleResponse = {
          success: false,
          message,
          steps: [],
        };
        setState({ loading: false, operation, steps: [], result: failedResult, error: message });
        return failedResult;
      }
    },
    [],
  );

  const install = useCallback(
    (pluginName: string, namespace?: string, values?: Record<string, unknown>) =>
      execute('install', (onProgress) =>
        lifecycleStreamRequest(
          `${API_BASE}/${encodeURIComponent(pluginName)}/install`,
          'POST',
          onProgress,
          { namespace, values },
        ),
      ),
    [execute],
  );

  const upgrade = useCallback(
    (pluginName: string, values?: Record<string, unknown>) =>
      execute('upgrade', (onProgress) =>
        lifecycleStreamRequest(
          `${API_BASE}/${encodeURIComponent(pluginName)}/upgrade`,
          'POST',
          onProgress,
          values ? { values } : undefined,
        ),
      ),
    [execute],
  );

  const remove = useCallback(
    (pluginName: string, deleteNamespace?: boolean) =>
      execute('remove', (onProgress) =>
        lifecycleStreamRequest(
          `${API_BASE}/${encodeURIComponent(pluginName)}${deleteNamespace ? '?deleteNamespace=true' : ''}`,
          'DELETE',
          onProgress,
        ),
      ),
    [execute],
  );

  const enable = useCallback(
    (pluginName: string) =>
      execute('enable', (onProgress) =>
        lifecycleStreamRequest(
          `${API_BASE}/${encodeURIComponent(pluginName)}/enable`,
          'POST',
          onProgress,
        ),
      ),
    [execute],
  );

  const disable = useCallback(
    (pluginName: string) =>
      execute('disable', (onProgress) =>
        lifecycleStreamRequest(
          `${API_BASE}/${encodeURIComponent(pluginName)}/disable`,
          'POST',
          onProgress,
        ),
      ),
    [execute],
  );

  const reset = useCallback(() => {
    setState({ loading: false, operation: null, steps: [], result: null, error: null });
  }, []);

  return { ...state, install, upgrade, remove, enable, disable, reset };
}
