import { renderHook, act, waitFor } from '@testing-library/react';
import { usePluginLifecycle } from '../usePluginLifecycle';

beforeEach(() => {
  jest.resetAllMocks();
});

const successResponse = { success: true, message: 'ok', steps: [] };

describe('usePluginLifecycle', () => {
  it('install sends POST to correct URL with body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(successResponse),
    });

    const { result } = renderHook(() => usePluginLifecycle());

    await act(async () => {
      await result.current.install('my-plugin', 'my-ns');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/community-plugins-admin/api/plugins/my-plugin/install',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ namespace: 'my-ns', values: undefined }),
      }),
    );
  });

  it('sets loading during request', async () => {
    let resolvePromise: (value: unknown) => void;
    const pending = new Promise((resolve) => { resolvePromise = resolve; });

    global.fetch = jest.fn().mockReturnValue(
      pending.then(() => ({ json: () => Promise.resolve(successResponse) })),
    );

    const { result } = renderHook(() => usePluginLifecycle());

    let installPromise: Promise<unknown>;
    act(() => {
      installPromise = result.current.install('my-plugin');
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.operation).toBe('install');

    await act(async () => {
      resolvePromise!(undefined);
      await installPromise!;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.result?.success).toBe(true);
  });

  it('upgrade sends POST to correct URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(successResponse),
    });

    const { result } = renderHook(() => usePluginLifecycle());

    await act(async () => {
      await result.current.upgrade('my-plugin');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/community-plugins-admin/api/plugins/my-plugin/upgrade',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('remove sends DELETE to correct URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(successResponse),
    });

    const { result } = renderHook(() => usePluginLifecycle());

    await act(async () => {
      await result.current.remove('my-plugin');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/community-plugins-admin/api/plugins/my-plugin',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('remove includes deleteNamespace query param when true', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(successResponse),
    });

    const { result } = renderHook(() => usePluginLifecycle());

    await act(async () => {
      await result.current.remove('my-plugin', true);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/community-plugins-admin/api/plugins/my-plugin?deleteNamespace=true',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('enable sends POST to correct URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(successResponse),
    });

    const { result } = renderHook(() => usePluginLifecycle());

    await act(async () => {
      await result.current.enable('my-plugin');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/community-plugins-admin/api/plugins/my-plugin/enable',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('disable sends POST to correct URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(successResponse),
    });

    const { result } = renderHook(() => usePluginLifecycle());

    await act(async () => {
      await result.current.disable('my-plugin');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/community-plugins-admin/api/plugins/my-plugin/disable',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('reset clears all state', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(successResponse),
    });

    const { result } = renderHook(() => usePluginLifecycle());

    await act(async () => {
      await result.current.install('my-plugin');
    });

    expect(result.current.result).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.result).toBeNull();
    expect(result.current.operation).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('handles network errors gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePluginLifecycle());

    await act(async () => {
      await result.current.install('my-plugin');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.result?.success).toBe(false);
  });
});
