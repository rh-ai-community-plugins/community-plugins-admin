import { render, screen, fireEvent, within } from '@testing-library/react';
import CatalogPage from '../CatalogPage';
import { useCatalog } from '~/app/hooks/useCatalog';
import { useInstalledPluginNames } from '~/app/hooks/useInstalledPluginNames';
import { CatalogPlugin } from '~/app/types/catalog';

jest.mock('~/app/hooks/useCatalog');
jest.mock('~/app/hooks/useInstalledPluginNames');

const mockUseCatalog = useCatalog as jest.MockedFunction<typeof useCatalog>;
const mockUseInstalledPluginNames = useInstalledPluginNames as jest.MockedFunction<
  typeof useInstalledPluginNames
>;

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
};

beforeEach(() => {
  jest.resetAllMocks();
  mockUseCatalog.mockReturnValue(defaultCatalogReturn);
  mockUseInstalledPluginNames.mockReturnValue(defaultInstalledReturn);
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
      installedNames: new Set(),
      entries: [],
      loading: true,
      error: null,
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
    expect(screen.getByText('plugin-alpha')).toBeInTheDocument();
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
      installedNames: new Set(),
      entries: [],
      loading: false,
      error: 'Failed to fetch dashboard deployment: 403',
    });
    render(<CatalogPage />);
    expect(
      screen.getByText('Unable to determine installed plugin status'),
    ).toBeInTheDocument();
    expect(screen.getByText('Install badges may be incomplete.')).toBeInTheDocument();
  });

  it('still renders the catalog when installedError is set — warning is non-blocking', () => {
    mockUseInstalledPluginNames.mockReturnValue({
      installedNames: new Set(),
      entries: [],
      loading: false,
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
});
