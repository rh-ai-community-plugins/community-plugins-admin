import { renderHook, act, waitFor } from '@testing-library/react';
import { useHelmReleasedPlugins } from '../useHelmReleasedPlugins';

const API_URL = '/community-plugins-admin/api/plugins';

const mockReleases = [
  { name: 'plugin-alpha', namespace: 'plugin-alpha', status: 'deployed' },
  { name: 'plugin-beta', namespace: 'plugin-beta', status: 'deployed' },
];

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn();
});

describe('useHelmReleasedPlugins', () => {
  it('fetches from the correct endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ releases: [] }),
    });

    renderHook(() => useHelmReleasedPlugins());
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        API_URL,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it('returns helmInstalledNames as a Set of release names', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ releases: mockReleases }),
    });

    const { result } = renderHook(() => useHelmReleasedPlugins());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.helmInstalledNames.has('plugin-alpha')).toBe(true);
    expect(result.current.helmInstalledNames.has('plugin-beta')).toBe(true);
    expect(result.current.helmInstalledNames.has('plugin-gamma')).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('starts with loading=true and empty Set', () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => {}));

    const { result } = renderHook(() => useHelmReleasedPlugins());
    expect(result.current.loading).toBe(true);
    expect(result.current.helmInstalledNames.size).toBe(0);
  });

  it('sets error and empty Set on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useHelmReleasedPlugins());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/500/);
    expect(result.current.helmInstalledNames.size).toBe(0);
  });

  it('sets error and empty Set on network failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useHelmReleasedPlugins());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network failure');
    expect(result.current.helmInstalledNames.size).toBe(0);
  });

  it('refetch triggers a new fetch', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ releases: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ releases: mockReleases }),
      });

    const { result } = renderHook(() => useHelmReleasedPlugins());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.helmInstalledNames.size).toBe(0);

    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.helmInstalledNames.size).toBe(2));

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('ignores AbortError on unmount', async () => {
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';
    (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

    const { result, unmount } = renderHook(() => useHelmReleasedPlugins());
    unmount();

    // Should not set error state
    expect(result.current.error).toBeNull();
  });
});
