import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PluginDetailModal from '../PluginDetailModal';
import { usePluginDetail, PluginDetailResult } from '~/app/hooks/usePluginDetail';
import { CatalogPlugin } from '~/app/types/catalog';

jest.mock('~/app/hooks/usePluginDetail');

const mockUsePluginDetail = usePluginDetail as jest.MockedFunction<typeof usePluginDetail>;

const fullPlugin: CatalogPlugin = {
  name: 'test-plugin',
  repo: 'https://github.com/org/test-plugin',
  status: 'stable',
  maintenance: 'red-hat',
  lastUpdated: '2026-01-01',
  metadataAvailable: true,
  displayName: 'Test Plugin',
  description: 'A comprehensive test plugin for the dashboard.',
  version: '2.1.0',
  maintainer: { name: 'Jane Doe', github: 'janedoe' },
  rhoaiCompatibility: {
    minVersion: '2.10',
    testedVersions: ['2.10', '2.11', '2.12'],
  },
  deploymentModel: 'cluster-shared',
  image: { repository: 'quay.io/org/test-plugin', tag: '2.1.0' },
  bffImage: { repository: 'quay.io/org/test-plugin-bff', tag: '2.1.0' },
  install: {
    method: 'automatic',
    helm: { registry: 'oci://quay.io/org/charts', chartPath: 'test-plugin' },
    prerequisites: ['ODF storage configured', 'GPU operator installed'],
  },
  rbac: {
    clusterRoles: true,
    requiredRoles: ['cluster-admin', 'test-plugin-manager'],
  },
  support: {
    repo: 'https://github.com/org/test-plugin',
    docs: 'https://docs.example.com/test-plugin',
    issues: 'https://github.com/org/test-plugin/issues',
  },
};

const minimalPlugin: CatalogPlugin = {
  name: 'minimal-plugin',
  repo: 'https://github.com/org/minimal-plugin',
  status: 'experimental',
  maintenance: 'community',
  lastUpdated: '2026-06-01',
  metadataAvailable: false,
};

const loadedResult = (
  plugin: CatalogPlugin,
  installed = false,
): PluginDetailResult => ({
  plugin,
  installed,
  loading: false,
  error: null,
});

const loadingResult: PluginDetailResult = {
  plugin: null,
  installed: false,
  loading: true,
  error: null,
};

const errorResult: PluginDetailResult = {
  plugin: null,
  installed: false,
  loading: false,
  error: 'Plugin "bad-plugin" not found',
};

const emptyNames = new Set<string>();

beforeEach(() => {
  jest.resetAllMocks();
});

describe('PluginDetailModal', () => {
  describe('open/close behavior', () => {
    it('does not render modal content when pluginName is null', () => {
      mockUsePluginDetail.mockReturnValue(loadedResult(fullPlugin));
      render(
        <PluginDetailModal pluginName={null} isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.queryByText('Test Plugin')).not.toBeInTheDocument();
    });

    it('renders modal when pluginName is provided', () => {
      mockUsePluginDetail.mockReturnValue(loadedResult(fullPlugin));
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('Test Plugin')).toBeInTheDocument();
    });

    it('calls onClose when footer close button is clicked', async () => {
      mockUsePluginDetail.mockReturnValue(loadedResult(fullPlugin));
      const onClose = jest.fn();
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={true} installedNames={emptyNames} installedLoading={false} onClose={onClose} />,
      );
      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      const footerClose = closeButtons[closeButtons.length - 1];
      await userEvent.click(footerClose);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('loading state', () => {
    it('shows spinner while loading', () => {
      mockUsePluginDetail.mockReturnValue(loadingResult);
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByLabelText('Loading plugin details')).toBeInTheDocument();
    });

    it('shows spinner when pluginName is set but no state has resolved yet', () => {
      mockUsePluginDetail.mockReturnValue({
        plugin: null,
        installed: false,
        loading: false,
        error: null,
      });
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByLabelText('Loading plugin details')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error alert when fetch fails', () => {
      mockUsePluginDetail.mockReturnValue(errorResult);
      render(
        <PluginDetailModal pluginName="bad-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('Failed to load plugin details')).toBeInTheDocument();
      expect(screen.getByText('Plugin "bad-plugin" not found')).toBeInTheDocument();
    });
  });

  describe('header section', () => {
    it('renders display name, version badge, status badge, and maintenance badge', () => {
      mockUsePluginDetail.mockReturnValue(loadedResult(fullPlugin));
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('Test Plugin')).toBeInTheDocument();
      expect(screen.getByText('v2.1.0')).toBeInTheDocument();
      expect(screen.getByText('Stable')).toBeInTheDocument();
      expect(screen.getByText('Red Hat')).toBeInTheDocument();
    });

    it('shows Installed badge when plugin is installed', () => {
      mockUsePluginDetail.mockReturnValue(loadedResult(fullPlugin, true));
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('Installed')).toBeInTheDocument();
    });

    it('does not show Installed badge when plugin is not installed', () => {
      mockUsePluginDetail.mockReturnValue(loadedResult(fullPlugin, false));
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.queryByText('Installed')).not.toBeInTheDocument();
    });

    it('uses name as fallback when displayName is missing', () => {
      mockUsePluginDetail.mockReturnValue(loadedResult(minimalPlugin));
      render(
        <PluginDetailModal pluginName="minimal-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('minimal-plugin')).toBeInTheDocument();
    });
  });

  describe('detail sections', () => {
    beforeEach(() => {
      mockUsePluginDetail.mockReturnValue(loadedResult(fullPlugin));
    });

    it('renders description', () => {
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(
        screen.getByText('A comprehensive test plugin for the dashboard.'),
      ).toBeInTheDocument();
    });

    it('renders maintainer with GitHub link', () => {
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('Maintainer')).toBeInTheDocument();
      const maintainerLink = screen.getByRole('link', { name: /Jane Doe/i });
      expect(maintainerLink).toHaveAttribute(
        'href',
        'https://github.com/janedoe',
      );
    });

    it('renders RHOAI compatibility', () => {
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('RHOAI Compatibility')).toBeInTheDocument();
      expect(screen.getByText(/Min version: 2.10/)).toBeInTheDocument();
      expect(screen.getByText('2.10')).toBeInTheDocument();
      expect(screen.getByText('2.11')).toBeInTheDocument();
      expect(screen.getByText('2.12')).toBeInTheDocument();
    });

    it('renders deployment model', () => {
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('Deployment Model')).toBeInTheDocument();
      expect(screen.getByText('Cluster-shared')).toBeInTheDocument();
    });

    it('renders container images', () => {
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('Container Images')).toBeInTheDocument();
      expect(screen.getByText('quay.io/org/test-plugin:2.1.0')).toBeInTheDocument();
      expect(screen.getByText('quay.io/org/test-plugin-bff:2.1.0')).toBeInTheDocument();
    });

    it('renders install method with helm info and prerequisites', () => {
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('Install Method')).toBeInTheDocument();
      expect(screen.getByText('Automatic')).toBeInTheDocument();
      expect(
        screen.getByText('oci://quay.io/org/charts'),
      ).toBeInTheDocument();
      expect(screen.getByText('ODF storage configured')).toBeInTheDocument();
      expect(screen.getByText('GPU operator installed')).toBeInTheDocument();
    });

    it('renders RBAC requirements', () => {
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('RBAC Requirements')).toBeInTheDocument();
      expect(screen.getByText('Requires cluster-level roles')).toBeInTheDocument();
      expect(screen.getByText('cluster-admin')).toBeInTheDocument();
      expect(screen.getByText('test-plugin-manager')).toBeInTheDocument();
    });

    it('renders support links', () => {
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('Support')).toBeInTheDocument();
      const repoLink = screen.getByRole('link', { name: /Repository/i });
      expect(repoLink).toHaveAttribute('href', 'https://github.com/org/test-plugin');
      const docsLink = screen.getByRole('link', { name: /Documentation/i });
      expect(docsLink).toHaveAttribute('href', 'https://docs.example.com/test-plugin');
      const issuesLink = screen.getByRole('link', { name: /Issues/i });
      expect(issuesLink).toHaveAttribute(
        'href',
        'https://github.com/org/test-plugin/issues',
      );
    });
  });

  describe('minimal plugin (no optional fields)', () => {
    it('renders without optional sections', () => {
      mockUsePluginDetail.mockReturnValue(loadedResult(minimalPlugin));
      render(
        <PluginDetailModal pluginName="minimal-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByText('minimal-plugin')).toBeInTheDocument();
      expect(screen.getByText('Experimental')).toBeInTheDocument();
      expect(screen.getByText('Community')).toBeInTheDocument();
      expect(screen.queryByText('Description')).not.toBeInTheDocument();
      expect(screen.queryByText('Maintainer')).not.toBeInTheDocument();
      expect(screen.queryByText('RHOAI Compatibility')).not.toBeInTheDocument();
      expect(screen.queryByText('Deployment Model')).not.toBeInTheDocument();
      expect(screen.queryByText('Container Images')).not.toBeInTheDocument();
      expect(screen.queryByText('Install Method')).not.toBeInTheDocument();
      expect(screen.queryByText('RBAC Requirements')).not.toBeInTheDocument();
      expect(screen.queryByText('Support')).not.toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('does not show action buttons for non-admin users but shows Close', () => {
      mockUsePluginDetail.mockReturnValue(loadedResult(fullPlugin, false));
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={false} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Upgrade' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('shows Install button for admin when plugin is not installed', () => {
      mockUsePluginDetail.mockReturnValue(loadedResult(fullPlugin, false));
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={true} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Upgrade' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    });

    it('shows Upgrade, Disable, Remove buttons for admin when plugin is installed', () => {
      mockUsePluginDetail.mockReturnValue(loadedResult(fullPlugin, true));
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={true} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Upgrade' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('action buttons are aria-disabled (stubs for Phase 6)', () => {
      mockUsePluginDetail.mockReturnValue(loadedResult(fullPlugin, true));
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={true} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      expect(screen.getByRole('button', { name: 'Upgrade' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Disable' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Remove' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('shows Close button in footer for admin', () => {
      mockUsePluginDetail.mockReturnValue(loadedResult(fullPlugin, false));
      render(
        <PluginDetailModal pluginName="test-plugin" isAdmin={true} installedNames={emptyNames} installedLoading={false} onClose={jest.fn()} />,
      );
      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
