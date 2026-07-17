import { render, screen, fireEvent } from '@testing-library/react';
import InstalledPage from '../InstalledPage';
import { useInstalledPlugins } from '~/app/hooks/useInstalledPlugins';
import { useCurrentUser } from '~/app/hooks/useCurrentUser';
import { InstalledPlugin } from '~/app/types/installed';

jest.mock('~/app/hooks/useInstalledPlugins');
jest.mock('~/app/hooks/useCurrentUser');
jest.mock('~/app/components/PluginDetailModal', () => {
  const MockModal = ({ pluginName }: { pluginName: string | null; isAdmin: boolean }) =>
    pluginName ? <div data-testid="plugin-detail-modal">{pluginName}</div> : null;
  MockModal.displayName = 'MockPluginDetailModal';
  return { __esModule: true, default: MockModal };
});

const mockUseInstalledPlugins = useInstalledPlugins as jest.MockedFunction<typeof useInstalledPlugins>;
const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;

const mockPlugins: InstalledPlugin[] = [
  {
    name: 'community-plugins-admin',
    scope: 'communityPluginsAdmin',
    module: './extensions',
    remoteEntry: 'http://cpa.ns.svc.cluster.local:8080/remoteEntry.js',
    enabled: true,
    healthStatus: 'running',
    availableReplicas: 1,
    desiredReplicas: 1,
    catalogPlugin: {
      name: 'community-plugins-admin',
      repo: 'https://github.com/org/community-plugins-admin',
      status: 'stable',
      maintenance: 'red-hat',
      lastUpdated: '2026-01-01',
      metadataAvailable: true,
      displayName: 'Community Plugins Admin',
      description: 'Admin plugin for managing community plugins',
      version: '1.0.0',
    },
  },
  {
    name: 'brewet',
    scope: 'brewet',
    module: './extensions',
    remoteEntry: 'http://brewet.ns.svc.cluster.local:8080/remoteEntry.js',
    enabled: true,
    healthStatus: 'degraded',
    availableReplicas: 1,
    desiredReplicas: 3,
    catalogPlugin: {
      name: 'brewet',
      repo: 'https://github.com/org/brewet',
      status: 'experimental',
      maintenance: 'community',
      lastUpdated: '2026-02-01',
      metadataAvailable: true,
      displayName: 'Brewet',
      description: 'Brewet storage plugin',
      version: '0.5.0',
    },
  },
  {
    name: 'unknown-plugin',
    scope: 'unknownPlugin',
    module: './extensions',
    remoteEntry: 'http://example.com/remoteEntry.js',
    enabled: true,
    healthStatus: 'unknown',
  },
];

const defaultReturn = {
  plugins: mockPlugins,
  loading: false,
  healthLoading: false,
  isRefetching: false,
  error: null,
  catalogError: null,
  refetch: jest.fn(),
};

const adminUser = {
  user: {
    currentContext: 'ctx',
    currentUser: 'admin',
    namespace: 'default',
    userName: 'admin',
    userID: '1',
    clusterID: 'c1',
    clusterBranding: '',
    isAdmin: true,
    isAllowed: true,
    serverURL: 'https://api.cluster.local:6443',
  },
  loading: false,
  error: null,
};

const nonAdminUser = {
  user: {
    ...adminUser.user,
    isAdmin: false,
    userName: 'viewer',
  },
  loading: false,
  error: null,
};

beforeEach(() => {
  jest.resetAllMocks();
  mockUseInstalledPlugins.mockReturnValue(defaultReturn);
  mockUseCurrentUser.mockReturnValue(adminUser);
});

describe('InstalledPage', () => {
  it('renders the page title', () => {
    render(<InstalledPage />);
    expect(screen.getByText('Installed Plugins')).toBeInTheDocument();
  });

  it('renders all installed plugins in the table', () => {
    render(<InstalledPage />);
    expect(screen.getByText('Community Plugins Admin')).toBeInTheDocument();
    expect(screen.getByText('Brewet')).toBeInTheDocument();
    expect(screen.getByText('unknown-plugin')).toBeInTheDocument();
  });

  it('shows loading spinner when loading', () => {
    mockUseInstalledPlugins.mockReturnValue({
      ...defaultReturn,
      loading: true,
      plugins: [],
    });
    render(<InstalledPage />);
    expect(screen.getByLabelText('Loading installed plugins')).toBeInTheDocument();
  });

  it('shows error alert when error occurs and no plugins loaded', () => {
    mockUseInstalledPlugins.mockReturnValue({
      ...defaultReturn,
      error: 'Something went wrong',
      plugins: [],
    });
    render(<InstalledPage />);
    expect(screen.getByText('Failed to load installed plugins')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows retry button on error', () => {
    const refetch = jest.fn();
    mockUseInstalledPlugins.mockReturnValue({
      ...defaultReturn,
      error: 'Network error',
      plugins: [],
      refetch,
    });
    render(<InstalledPage />);
    fireEvent.click(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no plugins are installed', () => {
    mockUseInstalledPlugins.mockReturnValue({
      ...defaultReturn,
      plugins: [],
    });
    render(<InstalledPage />);
    expect(screen.getByText('No plugins installed')).toBeInTheDocument();
    expect(
      screen.getByText('No community plugins are currently installed. Browse the Catalog to discover and install plugins.'),
    ).toBeInTheDocument();
  });

  it('shows no-match empty state when search filters all plugins', () => {
    render(<InstalledPage />);
    const searchInput = screen.getByPlaceholderText('Search by name or description');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.getByText('No plugins found')).toBeInTheDocument();
    expect(
      screen.getByText('No installed plugins match the current search.'),
    ).toBeInTheDocument();
  });

  it('shows version from catalog metadata', () => {
    render(<InstalledPage />);
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('0.5.0')).toBeInTheDocument();
  });

  it('shows dash when no catalog metadata is available', () => {
    render(<InstalledPage />);
    const cells = screen.getAllByText('—');
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Running status label', () => {
    render(<InstalledPage />);
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('shows Degraded status label', () => {
    render(<InstalledPage />);
    expect(screen.getByText('Degraded')).toBeInTheDocument();
  });

  it('shows Unknown status label', () => {
    render(<InstalledPage />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows maintenance labels from catalog', () => {
    render(<InstalledPage />);
    expect(screen.getByText('Red Hat')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
  });

  it('shows actions column for admin users', () => {
    render(<InstalledPage />);
    const table = screen.getByRole('grid');
    const headerCells = table.querySelectorAll('th');
    expect(headerCells).toHaveLength(5);
  });

  it('hides actions column for non-admin users', () => {
    mockUseCurrentUser.mockReturnValue(nonAdminUser);
    render(<InstalledPage />);
    const table = screen.getByRole('grid');
    const headerCells = table.querySelectorAll('th');
    expect(headerCells).toHaveLength(4);
  });

  it('filters plugins by search text matching display name', () => {
    render(<InstalledPage />);
    const searchInput = screen.getByPlaceholderText('Search by name or description');
    fireEvent.change(searchInput, { target: { value: 'Brewet' } });

    expect(screen.getByText('Brewet')).toBeInTheDocument();
    expect(screen.queryByText('Community Plugins Admin')).not.toBeInTheDocument();
  });

  it('filters plugins by search text matching description', () => {
    render(<InstalledPage />);
    const searchInput = screen.getByPlaceholderText('Search by name or description');
    fireEvent.change(searchInput, { target: { value: 'storage' } });

    expect(screen.getByText('Brewet')).toBeInTheDocument();
    expect(screen.queryByText('Community Plugins Admin')).not.toBeInTheDocument();
  });

  it('shows refresh button that calls refetch', () => {
    const refetch = jest.fn();
    mockUseInstalledPlugins.mockReturnValue({
      ...defaultReturn,
      refetch,
    });
    render(<InstalledPage />);
    fireEvent.click(screen.getByLabelText('Refresh installed plugins'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('disables refresh button while refetching', () => {
    mockUseInstalledPlugins.mockReturnValue({
      ...defaultReturn,
      isRefetching: true,
    });
    render(<InstalledPage />);
    expect(screen.getByLabelText('Refresh installed plugins')).toBeDisabled();
  });

  it('shows inline refresh spinner during refetch', () => {
    mockUseInstalledPlugins.mockReturnValue({
      ...defaultReturn,
      isRefetching: true,
    });
    render(<InstalledPage />);
    expect(screen.getByLabelText('Refreshing installed plugins')).toBeInTheDocument();
  });

  it('shows catalog error warning when catalog metadata fails', () => {
    mockUseInstalledPlugins.mockReturnValue({
      ...defaultReturn,
      catalogError: 'Catalog fetch failed',
    });
    render(<InstalledPage />);
    expect(screen.getByText('Unable to load catalog metadata')).toBeInTheDocument();
    expect(screen.getByText('Plugin details may be incomplete.')).toBeInTheDocument();
  });

  it('still renders the table when catalogError is set', () => {
    mockUseInstalledPlugins.mockReturnValue({
      ...defaultReturn,
      catalogError: 'Catalog fetch failed',
    });
    render(<InstalledPage />);
    expect(screen.getByText('Community Plugins Admin')).toBeInTheDocument();
    expect(screen.getByText('Brewet')).toBeInTheDocument();
  });

  it('does not show catalog warning when there is no catalog error', () => {
    render(<InstalledPage />);
    expect(screen.queryByText('Unable to load catalog metadata')).not.toBeInTheDocument();
  });

  it('shows loading spinners per row while health is loading', () => {
    mockUseInstalledPlugins.mockReturnValue({
      ...defaultReturn,
      healthLoading: true,
    });
    render(<InstalledPage />);
    expect(screen.getByLabelText('Checking community-plugins-admin status')).toBeInTheDocument();
    expect(screen.getByLabelText('Checking brewet status')).toBeInTheDocument();
  });

  it('opens plugin detail modal when row is clicked', () => {
    render(<InstalledPage />);
    const row = screen.getByText('Community Plugins Admin').closest('tr');
    fireEvent.click(row!);
    expect(screen.getByTestId('plugin-detail-modal')).toHaveTextContent('community-plugins-admin');
  });
});
