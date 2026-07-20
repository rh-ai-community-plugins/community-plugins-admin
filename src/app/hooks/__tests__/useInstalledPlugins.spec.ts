import { renderHook, waitFor } from '@testing-library/react';
import { useInstalledPlugins } from '../useInstalledPlugins';
import { extractServiceInfo } from '../useInstalledPluginNames';
import { useInstalledPluginNames } from '../useInstalledPluginNames';
import { useCatalog } from '../useCatalog';
import { useHelmReleasedPlugins } from '../useHelmReleasedPlugins';
import { CatalogPlugin } from '~/app/types/catalog';

jest.mock('../useInstalledPluginNames', () => {
  const actual = jest.requireActual('../useInstalledPluginNames');
  return {
    ...actual,
    useInstalledPluginNames: jest.fn(),
  };
});
jest.mock('../useCatalog');
jest.mock('../useHelmReleasedPlugins');

const mockUseInstalledPluginNames = useInstalledPluginNames as jest.MockedFunction<typeof useInstalledPluginNames>;
const mockUseCatalog = useCatalog as jest.MockedFunction<typeof useCatalog>;
const mockUseHelmReleasedPlugins = useHelmReleasedPlugins as jest.MockedFunction<typeof useHelmReleasedPlugins>;

const mockCatalogPlugins: CatalogPlugin[] = [
  {
    name: 'community-plugins-admin',
    repo: 'https://github.com/org/community-plugins-admin',
    status: 'stable',
    maintenance: 'red-hat',
    lastUpdated: '2026-01-01',
    metadataAvailable: true,
    displayName: 'Community Plugins Admin',
    description: 'Admin plugin',
    version: '1.0.0',
  },
  {
    name: 'brewet',
    repo: 'https://github.com/org/brewet',
    status: 'experimental',
    maintenance: 'community',
    lastUpdated: '2026-02-01',
    metadataAvailable: true,
    displayName: 'Brewet',
    description: 'Brewet plugin',
    version: '0.5.0',
  },
];

const defaultInstalledReturn = {
  installedNames: new Set(['community-plugins-admin', 'brewet']),
  entries: [
    {
      name: 'communityPluginsAdmin',
      backend: {
        remoteEntry: '/remoteEntry.js',
        tls: false,
        service: { name: 'community-plugins-admin', namespace: 'redhat-ods-applications', port: 8080 },
      },
    },
    {
      name: 'brewet',
      backend: {
        remoteEntry: '/remoteEntry.js',
        tls: false,
        service: { name: 'brewet', namespace: 'brewet-ns', port: 8080 },
      },
    },
  ],
  loading: false,
  error: null,
  refetch: jest.fn(),
};

const defaultCatalogReturn = {
  plugins: mockCatalogPlugins,
  loading: false,
  isRefetching: false,
  error: null,
  refetch: jest.fn(),
};

const mockRunningDeployment = {
  spec: { replicas: 1 },
  status: { replicas: 1, readyReplicas: 1, availableReplicas: 1 },
};

const mockDegradedDeployment = {
  spec: { replicas: 3 },
  status: { replicas: 3, readyReplicas: 1, availableReplicas: 1, unavailableReplicas: 2 },
};

const mockStoppedDeployment = {
  spec: { replicas: 1 },
  status: { replicas: 0, readyReplicas: 0, availableReplicas: 0 },
};

describe('extractServiceInfo', () => {
  it('extracts from new format (backend.service)', () => {
    const entry = {
      name: 'myPlugin',
      backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'my-service', namespace: 'my-namespace', port: 8080 } },
    };
    expect(extractServiceInfo(entry)).toEqual({ service: 'my-service', namespace: 'my-namespace' });
  });

  it('extracts from old flat format (top-level service)', () => {
    const entry = {
      name: 'modelRegistry',
      remoteEntry: '/remoteEntry.js',
      service: { name: 'rhods-dashboard', namespace: 'redhat-ods-applications', port: 8043 },
    };
    expect(extractServiceInfo(entry)).toEqual({ service: 'rhods-dashboard', namespace: 'redhat-ods-applications' });
  });

  it('falls back to parsing svc.cluster.local URL from remoteEntry', () => {
    const entry = {
      name: 'myPlugin',
      remoteEntry: 'http://my-service.my-namespace.svc.cluster.local:8080/remoteEntry.js',
    };
    expect(extractServiceInfo(entry)).toEqual({ service: 'my-service', namespace: 'my-namespace' });
  });

  it('returns null for non-cluster URLs', () => {
    expect(extractServiceInfo({ name: 'x', remoteEntry: 'http://example.com/remoteEntry.js' })).toBeNull();
    expect(extractServiceInfo({ name: 'x', remoteEntry: '/remoteEntry.js' })).toBeNull();
  });

  it('returns null when no service info available', () => {
    expect(extractServiceInfo({ name: 'proxyOnly' })).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractServiceInfo({ name: 'x', remoteEntry: '' })).toBeNull();
  });
});

const defaultHelmReturn = {
  helmInstalledNames: new Set<string>(['community-plugins-admin', 'brewet']),
  helmVersionMap: new Map<string, string>([
    ['community-plugins-admin', '1.0.0'],
    ['brewet', '0.5.0'],
  ]),
  loading: false,
  error: null,
  refetch: jest.fn(),
};

describe('useInstalledPlugins', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUseInstalledPluginNames.mockReturnValue(defaultInstalledReturn);
    mockUseCatalog.mockReturnValue(defaultCatalogReturn);
    mockUseHelmReleasedPlugins.mockReturnValue(defaultHelmReturn);
    global.fetch = jest.fn();
  });

  it('returns empty array while loading', () => {
    mockUseInstalledPluginNames.mockReturnValue({
      ...defaultInstalledReturn,
      loading: true,
      entries: [],
    });

    const { result } = renderHook(() => useInstalledPlugins());

    expect(result.current.loading).toBe(true);
    expect(result.current.plugins).toEqual([]);
  });

  it('merges installed entries with catalog metadata', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRunningDeployment),
    });

    const { result } = renderHook(() => useInstalledPlugins());

    await waitFor(() => expect(result.current.healthLoading).toBe(false));

    expect(result.current.plugins).toHaveLength(2);

    const adminPlugin = result.current.plugins.find((p) => p.name === 'community-plugins-admin');
    expect(adminPlugin).toBeDefined();
    expect(adminPlugin!.catalogPlugin?.displayName).toBe('Community Plugins Admin');
    expect(adminPlugin!.catalogPlugin?.version).toBe('1.0.0');
    expect(adminPlugin!.enabled).toBe(true);

    const brewetPlugin = result.current.plugins.find((p) => p.name === 'brewet');
    expect(brewetPlugin).toBeDefined();
    expect(brewetPlugin!.catalogPlugin?.displayName).toBe('Brewet');
  });

  it('handles plugins not in the catalog', async () => {
    mockUseCatalog.mockReturnValue({ ...defaultCatalogReturn, plugins: [] });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRunningDeployment),
    });

    const { result } = renderHook(() => useInstalledPlugins());

    await waitFor(() => expect(result.current.healthLoading).toBe(false));

    expect(result.current.plugins).toHaveLength(2);
    expect(result.current.plugins[0].catalogPlugin).toBeUndefined();
    expect(result.current.plugins[0].name).toBe('community-plugins-admin');
  });

  it('resolves running health status from deployment', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRunningDeployment),
    });

    const { result } = renderHook(() => useInstalledPlugins());

    await waitFor(() => expect(result.current.healthLoading).toBe(false));

    expect(result.current.plugins[0].healthStatus).toBe('running');
    expect(result.current.plugins[0].availableReplicas).toBe(1);
    expect(result.current.plugins[0].desiredReplicas).toBe(1);
  });

  it('resolves degraded health status from deployment', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDegradedDeployment),
    });

    const { result } = renderHook(() => useInstalledPlugins());

    await waitFor(() => expect(result.current.healthLoading).toBe(false));

    expect(result.current.plugins[0].healthStatus).toBe('degraded');
    expect(result.current.plugins[0].availableReplicas).toBe(1);
    expect(result.current.plugins[0].desiredReplicas).toBe(3);
  });

  it('resolves stopped health status from deployment', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStoppedDeployment),
    });

    const { result } = renderHook(() => useInstalledPlugins());

    await waitFor(() => expect(result.current.healthLoading).toBe(false));

    expect(result.current.plugins[0].healthStatus).toBe('stopped');
  });

  it('returns unknown status when deployment fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });

    const { result } = renderHook(() => useInstalledPlugins());

    await waitFor(() => expect(result.current.healthLoading).toBe(false));

    expect(result.current.plugins[0].healthStatus).toBe('unknown');
  });

  it('returns unknown status when entry has no service info', async () => {
    mockUseInstalledPluginNames.mockReturnValue({
      ...defaultInstalledReturn,
      entries: [
        { name: 'proxyOnly', proxyService: [{ path: '/proxy/api', pathRewrite: '/api', service: { name: 'svc', namespace: 'ns', port: 3000 } }] },
      ],
    });

    const { result } = renderHook(() => useInstalledPlugins());

    await waitFor(() => expect(result.current.healthLoading).toBe(false));

    expect(result.current.plugins[0].healthStatus).toBe('unknown');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('propagates names error', () => {
    mockUseInstalledPluginNames.mockReturnValue({
      ...defaultInstalledReturn,
      error: 'Failed to fetch dashboard deployment: 403',
    });

    const { result } = renderHook(() => useInstalledPlugins());

    expect(result.current.error).toBe('Failed to fetch dashboard deployment: 403');
  });

  it('exposes catalog error separately', () => {
    mockUseCatalog.mockReturnValue({
      ...defaultCatalogReturn,
      error: 'Catalog fetch failed',
    });

    const { result } = renderHook(() => useInstalledPlugins());

    expect(result.current.catalogError).toBe('Catalog fetch failed');
  });

  it('refetch calls namesRefetch, catalogRefetch, and helmRefetch', () => {
    const namesRefetchFn = jest.fn();
    const catalogRefetchFn = jest.fn();
    const helmRefetchFn = jest.fn();
    mockUseInstalledPluginNames.mockReturnValue({
      ...defaultInstalledReturn,
      refetch: namesRefetchFn,
    });
    mockUseCatalog.mockReturnValue({
      ...defaultCatalogReturn,
      refetch: catalogRefetchFn,
    });
    mockUseHelmReleasedPlugins.mockReturnValue({
      ...defaultHelmReturn,
      refetch: helmRefetchFn,
    });

    const { result } = renderHook(() => useInstalledPlugins());
    result.current.refetch();

    expect(namesRefetchFn).toHaveBeenCalledTimes(1);
    expect(catalogRefetchFn).toHaveBeenCalledTimes(1);
    expect(helmRefetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not run health checks when entries are empty', () => {
    mockUseInstalledPluginNames.mockReturnValue({
      ...defaultInstalledReturn,
      entries: [],
      installedNames: new Set(),
    });

    const { result } = renderHook(() => useInstalledPlugins());

    expect(result.current.plugins).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
