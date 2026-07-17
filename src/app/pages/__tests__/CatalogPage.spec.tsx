import { render, screen, fireEvent, within } from '@testing-library/react';
import CatalogPage from '../CatalogPage';
import { useCatalog } from '~/app/hooks/useCatalog';
import { useInstalledPluginNames } from '~/app/hooks/useInstalledPluginNames';
import { useHelmReleasedPlugins } from '~/app/hooks/useHelmReleasedPlugins';
import { useCurrentUser } from '~/app/hooks/useCurrentUser';
import { CatalogPlugin } from '~/app/types/catalog';

jest.mock('~/app/hooks/useCatalog');
jest.mock('~/app/hooks/useInstalledPluginNames');
jest.mock('~/app/hooks/useHelmReleasedPlugins');
jest.mock('~/app/hooks/useCurrentUser');
jest.mock('~/app/components/PluginDetailModal', () => {
  const MockModal = ({ pluginName }: { pluginName: string | null; isAdmin: boolean }) =>
    pluginName ? <div data-testid="plugin-detail-modal">{pluginName}</div> : null;
  MockModal.displayName = 'MockPluginDetailModal';
  return { __esModule: true, default: MockModal };
});

const mockUseCatalog = useCatalog as jest.MockedFunction<typeof useCatalog>;
const mockUseInstalledPluginNames = useInstalledPluginNames as jest.MockedFunction<
  typeof useInstalledPluginNames
>;
const mockUseHelmReleasedPlugins = useHelmReleasedPlugins as jest.MockedFunction<
  typeof useHelmReleasedPlugins
>;
const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;

const mockPlugins: CatalogPlugin[] = [
  {
    name: 'plugin-alpha',
    repo: 'https://github.com/org/plugin-alpha',
    status: 'stable',
    maintenance: 'red-hat',
    lastUpdated: '2026-01-01',
    metadataAvailable: true,
    displayName: 'Plugin Alpha',
    description: 'Alpha plugin for testing',
    version: '2.0.0',
    deploymentModel: 'cluster-shared',
  },
  {
    name: 'plugin-beta',
    repo: 'https://github.com/org/plugin-beta',
    status: 'experimental',
    maintenance: 'community',
    lastUpdated: '2026-02-01',
    metadataAvailable: true,
    displayName: 'Plugin Beta',
    description: 'Beta plugin for experiments',
    version: '0.5.0',
  },
  {
    name: 'plugin-gamma',
    repo: 'https://github.com/org/plugin-gamma',
    status: 'experimental',
    maintenance: 'red-hat',
    lastUpdated: '2026-03-01',
    metadataAvailable: false,
  },
];

const defaultCatalogReturn = {
  plugins: mockPlugins,
  loading: false,
  isRefetching: false,
  error: null,
  refetch: jest.fn(),
};

const defaultInstalledReturn = {
  installedNames: new Set(['plugin-alpha']),
  entries: [],
  loading: false,
  error: null,
  refetch: jest.fn(),
};

const defaultHelmReturn = {
  helmInstalledNames: new Set(['plugin-alpha']),
  helmVersionMap: new Map<string, string>(),
  loading: false,
  error: null,
  refetch: jest.fn(),
};

beforeEach(() => {
  jest.resetAllMocks();
  mockUseCatalog.mockReturnValue(defaultCatalogReturn);
  mockUseInstalledPluginNames.mockReturnValue(defaultInstalledReturn);
  mockUseHelmReleasedPlugins.mockReturnValue(defaultHelmReturn);
  mockUseCurrentUser.mockReturnValue({ user: null, loading: false, error: null });
});

describe('CatalogPage', () => {
  it('renders the page title', () => {
    render(<CatalogPage />);
    expect(screen.getByText('Catalog')).toBeInTheDocument();
  });

  it('renders all plugin cards', () => {
    render(<CatalogPage />);
    expect(screen.getByText('Plugin Alpha')).toBeInTheDocument();
    expect(screen.getByText('Plugin Beta')).toBeInTheDocument();
    expect(screen.getByText('plugin-gamma')).toBeInTheDocument();
  });

  it('shows loading spinner when loading (initial load with no data)', () => {
    mockUseCatalog.mockReturnValue({
      ...defaultCatalogReturn,
      loading: true,
      plugins: [],
    });
    render(<CatalogPage />);
    expect(screen.getByLabelText('Loading catalog')).toBeInTheDocument();
  });

  it('shows loading spinner when installedNames is still loading (race condition guard)', () => {
    mockUseInstalledPluginNames.mockReturnValue({
      ...defaultInstalledReturn,
      installedNames: new Set(),
      loading: true,
    });
    render(<CatalogPage />);
    expect(screen.getByLabelText('Loading catalog')).toBeInTheDocument();
    expect(screen.queryByText('Plugin Alpha')).not.toBeInTheDocument();
  });

  it('shows loading spinner when helmInstalledNames is still loading', () => {
    mockUseHelmReleasedPlugins.mockReturnValue({
      ...defaultHelmReturn,
      helmInstalledNames: new Set(),
      loading: true,
    });
    render(<CatalogPage />);
    expect(screen.getByLabelText('Loading catalog')).toBeInTheDocument();
    expect(screen.queryByText('Plugin Alpha')).not.toBeInTheDocument();
  });

  it('does not show full-page spinner during refetch — keeps card grid visible', () => {
    mockUseCatalog.mockReturnValue({
      ...defaultCatalogReturn,
      isRefetching: true,
      loading: false,
    });
    render(<CatalogPage />);
    expect(screen.queryByLabelText('Loading catalog')).not.toBeInTheDocument();
    expect(screen.getByText('Plugin Alpha')).toBeInTheDocument();
    expect(screen.getByText('Plugin Beta')).toBeInTheDocument();
  });

  it('shows inline refetch spinner in toolbar during refetch', () => {
    mockUseCatalog.mockReturnValue({
      ...defaultCatalogReturn,
      isRefetching: true,
      loading: false,
    });
    render(<CatalogPage />);
    expect(screen.getByLabelText('Refreshing catalog')).toBeInTheDocument();
  });

  it('disables Refresh button while refetch is in flight', () => {
    mockUseCatalog.mockReturnValue({
      ...defaultCatalogReturn,
      isRefetching: true,
      loading: false,
    });
    render(<CatalogPage />);
    expect(screen.getByLabelText('Refresh catalog')).toBeDisabled();
  });

  it('shows error alert on error', () => {
    mockUseCatalog.mockReturnValue({
      ...defaultCatalogReturn,
      error: 'Something went wrong',
      plugins: [],
    });
    render(<CatalogPage />);
    expect(screen.getByText('Failed to load catalog')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows retry button on error', () => {
    const refetch = jest.fn();
    mockUseCatalog.mockReturnValue({
      ...defaultCatalogReturn,
      error: 'Network error',
      plugins: [],
      refetch,
    });
    render(<CatalogPage />);
    fireEvent.click(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when catalog is empty', () => {
    mockUseCatalog.mockReturnValue({
      ...defaultCatalogReturn,
      plugins: [],
    });
    render(<CatalogPage />);
    expect(screen.getByText('The plugin catalog is empty.')).toBeInTheDocument();
  });

  it('shows Installed badge on installed plugins', () => {
    render(<CatalogPage />);
    const alphaCard = screen.getByText('Plugin Alpha').closest('.pf-v6-c-card');
    expect(alphaCard).toBeTruthy();
    expect(within(alphaCard! as HTMLElement).getByText('Installed')).toBeInTheDocument();

    const betaCard = screen.getByText('Plugin Beta').closest('.pf-v6-c-card');
    expect(betaCard).toBeTruthy();
    expect(within(betaCard! as HTMLElement).queryByText('Installed')).not.toBeInTheDocument();
  });

  it('shows status labels on cards', () => {
    render(<CatalogPage />);
    expect(screen.getAllByText('Stable')).toHaveLength(1);
    expect(screen.getAllByText('Experimental')).toHaveLength(2);
  });

  it('shows maintenance labels on cards', () => {
    render(<CatalogPage />);
    expect(screen.getAllByText('Red Hat')).toHaveLength(2);
    expect(screen.getAllByText('Community')).toHaveLength(1);
  });

  it('shows version on cards with metadata', () => {
    render(<CatalogPage />);
    expect(screen.getByText('Version 2.0.0')).toBeInTheDocument();
    expect(screen.getByText('Version 0.5.0')).toBeInTheDocument();
  });

  it('shows metadata unavailable for plugins without metadata', () => {
    render(<CatalogPage />);
    expect(screen.getByText('Metadata unavailable')).toBeInTheDocument();
  });

  it('filters plugins by search text matching name', () => {
    render(<CatalogPage />);
    const searchInput = screen.getByPlaceholderText('Search by name or description');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    expect(screen.getByText('Plugin Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Plugin Beta')).not.toBeInTheDocument();
    expect(screen.queryByText('plugin-gamma')).not.toBeInTheDocument();
  });

  it('filters plugins by search text matching description', () => {
    render(<CatalogPage />);
    const searchInput = screen.getByPlaceholderText('Search by name or description');
    fireEvent.change(searchInput, { target: { value: 'experiments' } });

    expect(screen.queryByText('Plugin Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Plugin Beta')).toBeInTheDocument();
  });

  it('shows no plugins found when search has no matches', () => {
    render(<CatalogPage />);
    const searchInput = screen.getByPlaceholderText('Search by name or description');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('No plugins match the current filters.')).toBeInTheDocument();
  });

  it('opens plugin detail modal when card is clicked', () => {
    render(<CatalogPage />);
    const cardButton = screen.getByLabelText('View details for Plugin Alpha');
    fireEvent.click(cardButton);
    expect(screen.getByTestId('plugin-detail-modal')).toHaveTextContent('plugin-alpha');
  });

  it('filters plugins when only stable plugins match', () => {
    mockUseCatalog.mockReturnValue({
      ...defaultCatalogReturn,
      plugins: mockPlugins.filter((p) => p.status === 'stable'),
    });
    render(<CatalogPage />);

    expect(screen.getByText('Plugin Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Plugin Beta')).not.toBeInTheDocument();
    expect(screen.queryByText('plugin-gamma')).not.toBeInTheDocument();
  });

  it('filters plugins when only community maintenance plugins are returned', () => {
    mockUseCatalog.mockReturnValue({
      ...defaultCatalogReturn,
      plugins: mockPlugins.filter((p) => p.maintenance === 'community'),
    });
    render(<CatalogPage />);

    expect(screen.queryByText('Plugin Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Plugin Beta')).toBeInTheDocument();
    expect(screen.queryByText('plugin-gamma')).not.toBeInTheDocument();
  });

  it('shows only installed plugins when all non-installed are filtered by search', () => {
    render(<CatalogPage />);
    const searchInput = screen.getByPlaceholderText('Search by name or description');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    expect(screen.getByText('Plugin Alpha')).toBeInTheDocument();
    const alphaCard = screen.getByText('Plugin Alpha').closest('.pf-v6-c-card');
    expect(within(alphaCard! as HTMLElement).getByText('Installed')).toBeInTheDocument();
    expect(screen.queryByText('Plugin Beta')).not.toBeInTheDocument();
  });

  it('shows refresh button that calls refetch', () => {
    const refetch = jest.fn();
    mockUseCatalog.mockReturnValue({
      ...defaultCatalogReturn,
      refetch,
    });
    render(<CatalogPage />);
    fireEvent.click(screen.getByLabelText('Refresh catalog'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows warning alert when installedError is set', () => {
    mockUseInstalledPluginNames.mockReturnValue({
      ...defaultInstalledReturn,
      installedNames: new Set(),
      error: 'Failed to fetch dashboard deployment: 403',
    });
    render(<CatalogPage />);
    expect(
      screen.getByText('Unable to determine installed plugin status'),
    ).toBeInTheDocument();
    expect(screen.getByText('Install and disabled badges may be incomplete.')).toBeInTheDocument();
  });

  it('shows warning alert when helmError is set', () => {
    mockUseHelmReleasedPlugins.mockReturnValue({
      ...defaultHelmReturn,
      helmInstalledNames: new Set(),
      error: 'Failed to fetch Helm releases: 500',
    });
    render(<CatalogPage />);
    expect(
      screen.getByText('Unable to determine installed plugin status'),
    ).toBeInTheDocument();
    expect(screen.getByText('Install and disabled badges may be incomplete.')).toBeInTheDocument();
  });

  it('still renders the catalog when installedError is set — warning is non-blocking', () => {
    mockUseInstalledPluginNames.mockReturnValue({
      ...defaultInstalledReturn,
      installedNames: new Set(),
      error: 'Failed to fetch dashboard deployment: 500',
    });
    render(<CatalogPage />);
    expect(screen.getByText('Plugin Alpha')).toBeInTheDocument();
    expect(screen.getByText('Plugin Beta')).toBeInTheDocument();
    expect(screen.getByText('plugin-gamma')).toBeInTheDocument();
  });

  it('does not show warning alert when installedError is null', () => {
    render(<CatalogPage />);
    expect(
      screen.queryByText('Unable to determine installed plugin status'),
    ).not.toBeInTheDocument();
  });

  it('shows Disabled badge on disabled plugins (helm installed, not enabled)', () => {
    // plugin-beta is helm-installed but not in installedNames → disabled
    mockUseInstalledPluginNames.mockReturnValue({
      ...defaultInstalledReturn,
      installedNames: new Set(['plugin-alpha']),
    });
    mockUseHelmReleasedPlugins.mockReturnValue({
      ...defaultHelmReturn,
      helmInstalledNames: new Set(['plugin-alpha', 'plugin-beta']),
    });
    render(<CatalogPage />);

    const betaCard = screen.getByText('Plugin Beta').closest('.pf-v6-c-card');
    expect(betaCard).toBeTruthy();
    expect(within(betaCard! as HTMLElement).getByText('Disabled')).toBeInTheDocument();
  });

  it('does not show Disabled badge on enabled installed plugins', () => {
    mockUseInstalledPluginNames.mockReturnValue({
      ...defaultInstalledReturn,
      installedNames: new Set(['plugin-alpha']),
    });
    mockUseHelmReleasedPlugins.mockReturnValue({
      ...defaultHelmReturn,
      helmInstalledNames: new Set(['plugin-alpha']),
    });
    render(<CatalogPage />);

    const alphaCard = screen.getByText('Plugin Alpha').closest('.pf-v6-c-card');
    expect(alphaCard).toBeTruthy();
    expect(within(alphaCard! as HTMLElement).queryByText('Disabled')).not.toBeInTheDocument();
    expect(within(alphaCard! as HTMLElement).getByText('Installed')).toBeInTheDocument();
  });

  it('does not show Disabled badge on plugins not in helmInstalledNames', () => {
    mockUseHelmReleasedPlugins.mockReturnValue({
      ...defaultHelmReturn,
      helmInstalledNames: new Set([]),
    });
    render(<CatalogPage />);

    const betaCard = screen.getByText('Plugin Beta').closest('.pf-v6-c-card');
    expect(betaCard).toBeTruthy();
    expect(within(betaCard! as HTMLElement).queryByText('Disabled')).not.toBeInTheDocument();
  });

  it('shows update available badge when installed version differs from catalog version', () => {
    // plugin-alpha catalog version is '2.0.0', installed version is '1.0.0'
    mockUseHelmReleasedPlugins.mockReturnValue({
      ...defaultHelmReturn,
      helmInstalledNames: new Set(['plugin-alpha']),
      helmVersionMap: new Map([['plugin-alpha', '1.0.0']]),
    });
    render(<CatalogPage />);

    const alphaCard = screen.getByText('Plugin Alpha').closest('.pf-v6-c-card');
    expect(alphaCard).toBeTruthy();
    expect(
      within(alphaCard! as HTMLElement).getByText('Update available: 1.0.0 → 2.0.0'),
    ).toBeInTheDocument();
  });

  it('does not show update available badge when versions match', () => {
    // plugin-alpha catalog version is '2.0.0', installed version also '2.0.0'
    mockUseHelmReleasedPlugins.mockReturnValue({
      ...defaultHelmReturn,
      helmInstalledNames: new Set(['plugin-alpha']),
      helmVersionMap: new Map([['plugin-alpha', '2.0.0']]),
    });
    render(<CatalogPage />);

    const alphaCard = screen.getByText('Plugin Alpha').closest('.pf-v6-c-card');
    expect(alphaCard).toBeTruthy();
    expect(
      within(alphaCard! as HTMLElement).queryByText(/Update available/),
    ).not.toBeInTheDocument();
  });

  it('does not show update available badge when helmVersionMap has no entry for the plugin', () => {
    // plugin-alpha is installed but no version info in helmVersionMap
    mockUseHelmReleasedPlugins.mockReturnValue({
      ...defaultHelmReturn,
      helmInstalledNames: new Set(['plugin-alpha']),
      helmVersionMap: new Map(),
    });
    render(<CatalogPage />);

    const alphaCard = screen.getByText('Plugin Alpha').closest('.pf-v6-c-card');
    expect(alphaCard).toBeTruthy();
    expect(
      within(alphaCard! as HTMLElement).queryByText(/Update available/),
    ).not.toBeInTheDocument();
  });

  it('does not show update available badge when catalog plugin has no version', () => {
    // plugin-gamma has no version in catalog; it would be installed here to test
    mockUseInstalledPluginNames.mockReturnValue({
      ...defaultInstalledReturn,
      installedNames: new Set(['plugin-gamma']),
    });
    mockUseHelmReleasedPlugins.mockReturnValue({
      ...defaultHelmReturn,
      helmInstalledNames: new Set(['plugin-gamma']),
      helmVersionMap: new Map([['plugin-gamma', '1.0.0']]),
    });
    render(<CatalogPage />);

    const gammaCard = screen.getByText('plugin-gamma').closest('.pf-v6-c-card');
    expect(gammaCard).toBeTruthy();
    expect(
      within(gammaCard! as HTMLElement).queryByText(/Update available/),
    ).not.toBeInTheDocument();
  });
});
