import { renderHook, waitFor } from '@testing-library/react';
import { useCatalog } from '../useCatalog';
import { CatalogPlugin } from '~/app/types/catalog';

const mockPlugins: CatalogPlugin[] = [
  {
    name: 'plugin-a',
    repo: 'https://github.com/org/plugin-a',
    status: 'stable',
    maintenance: 'red-hat',
    lastUpdated: '2026-01-01',
    metadataAvailable: true,
    displayName: 'Plugin A',
    description: 'A test plugin',
    version: '1.0.0',
  },
  {
    name: 'plugin-b',
    repo: 'https://github.com/org/plugin-b',
    status: 'experimental',
    maintenance: 'community',
    lastUpdated: '2026-02-01',
    metadataAvailable: false,
  },
];

describe('useCatalog', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return plugins on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ plugins: mockPlugins }),
    });

    const { result } = renderHook(() => useCatalog());

    expect(result.current.loading).toBe(true);
    expect(result.current.isRefetching).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.plugins).toEqual(mockPlugins);
    expect(result.current.isRefetching).toBe(false);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      '/community-plugins-admin/api/catalog',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('should return error on fetch failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
    });

    const { result } = renderHook(() => useCatalog());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.plugins).toEqual([]);
    expect(result.current.error).toBe('Failed to fetch catalog: 502');
  });

  it('should return error on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCatalog());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.plugins).toEqual([]);
    expect(result.current.error).toBe('Network error');
  });

  it('should return error on invalid response shape', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: 'something went wrong' }),
    });

    const { result } = renderHook(() => useCatalog());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.plugins).toEqual([]);
    expect(result.current.error).toBe('Invalid catalog response');
  });

  it('should refetch with refresh=true when refetch is called', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ plugins: mockPlugins }),
    });

    const { result } = renderHook(() => useCatalog());

    await waitFor(() => expect(result.current.loading).toBe(false));

    result.current.refetch();

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/community-plugins-admin/api/catalog?refresh=true',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });

  it('should not set loading on refetch when plugins already exist', async () => {
    let resolveFetch!: (value: unknown) => void;
    global.fetch = jest
      .fn()
      // initial fetch resolves immediately
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ plugins: mockPlugins }),
      })
      // refetch hangs until we resolve it manually
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );

    const { result } = renderHook(() => useCatalog());

    // Wait for initial load to complete
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.plugins).toEqual(mockPlugins);

    // Trigger refetch
    result.current.refetch();

    // loading must stay false; isRefetching must become true
    await waitFor(() => expect(result.current.isRefetching).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.plugins).toEqual(mockPlugins);

    // Resolve the pending fetch
    resolveFetch({
      ok: true,
      json: () => Promise.resolve({ plugins: mockPlugins }),
    });

    await waitFor(() => expect(result.current.isRefetching).toBe(false));
    expect(result.current.loading).toBe(false);
  });
});
