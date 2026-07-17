import { renderHook, waitFor } from '@testing-library/react';
import { usePluginDetail } from '../usePluginDetail';
import { CatalogPlugin } from '~/app/types/catalog';

const mockPlugin: CatalogPlugin = {
  name: 'test-plugin',
  repo: 'https://github.com/org/test-plugin',
  status: 'stable',
  maintenance: 'red-hat',
  lastUpdated: '2026-01-01',
  metadataAvailable: true,
  displayName: 'Test Plugin',
  description: 'A test plugin',
  version: '1.0.0',
};

const emptyNames = new Set<string>();

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn();
});

it('returns null plugin and no loading when pluginName is null', () => {
  const { result } = renderHook(() => usePluginDetail(null, emptyNames, false));
  expect(result.current.plugin).toBeNull();
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBeNull();
  expect(result.current.installed).toBe(false);
});

it('fetches plugin detail on mount', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockPlugin),
  });

  const { result } = renderHook(() => usePluginDetail('test-plugin', emptyNames, false));

  expect(result.current.loading).toBe(true);

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.plugin).toEqual(mockPlugin);
  expect(result.current.error).toBeNull();
  expect(global.fetch).toHaveBeenCalledWith(
    '/community-plugins-admin/api/catalog/test-plugin',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

it('sets error on 404 response', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status: 404,
    json: () => Promise.resolve({}),
  });

  const { result } = renderHook(() => usePluginDetail('missing-plugin', emptyNames, false));

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.plugin).toBeNull();
  expect(result.current.error).toBe('Plugin "missing-plugin" not found');
});

it('sets error on server error', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status: 500,
    json: () => Promise.resolve({}),
  });

  const { result } = renderHook(() => usePluginDetail('bad-plugin', emptyNames, false));

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.plugin).toBeNull();
  expect(result.current.error).toBe('Failed to fetch plugin details: 500');
});

it('reports installed=true when plugin is in installed names', async () => {
  const installedSet = new Set(['test-plugin']);

  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockPlugin),
  });

  const { result } = renderHook(() => usePluginDetail('test-plugin', installedSet, false));

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.installed).toBe(true);
});

it('reports installed=false when plugin is not installed', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockPlugin),
  });

  const { result } = renderHook(() => usePluginDetail('test-plugin', emptyNames, false));

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.installed).toBe(false);
});

it('includes installedLoading in loading state', () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockPlugin),
  });

  const { result } = renderHook(() => usePluginDetail('test-plugin', emptyNames, true));
  expect(result.current.loading).toBe(true);
});

it('encodes plugin name in URL', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockPlugin),
  });

  renderHook(() => usePluginDetail('plugin with spaces', emptyNames, false));

  expect(global.fetch).toHaveBeenCalledWith(
    '/community-plugins-admin/api/catalog/plugin%20with%20spaces',
    expect.any(Object),
  );
});

it('resets state when pluginName changes to null', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockPlugin),
  });

  const { result, rerender } = renderHook(
    ({ name }) => usePluginDetail(name, emptyNames, false),
    { initialProps: { name: 'test-plugin' as string | null } },
  );

  await waitFor(() => {
    expect(result.current.plugin).toEqual(mockPlugin);
  });

  rerender({ name: null });

  expect(result.current.plugin).toBeNull();
  expect(result.current.error).toBeNull();
  expect(result.current.loading).toBe(false);
});
