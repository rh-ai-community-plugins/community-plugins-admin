import React, { useState, useMemo } from 'react';
import {
  PageSection,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  SearchInput,
  Spinner,
  EmptyState,
  EmptyStateBody,
  Button,
  Bullseye,
  Alert,
  Label,
} from '@patternfly/react-core';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  ActionsColumn,
  IAction,
} from '@patternfly/react-table';
import SearchIcon from '@patternfly/react-icons/dist/js/icons/search-icon';
import CheckCircleIcon from '@patternfly/react-icons/dist/js/icons/check-circle-icon';
import ExclamationTriangleIcon from '@patternfly/react-icons/dist/js/icons/exclamation-triangle-icon';
import ExclamationCircleIcon from '@patternfly/react-icons/dist/js/icons/exclamation-circle-icon';
import QuestionCircleIcon from '@patternfly/react-icons/dist/js/icons/question-circle-icon';
import { useInstalledPlugins } from '~/app/hooks/useInstalledPlugins';
import { useCurrentUser } from '~/app/hooks/useCurrentUser';
import PluginDetailModal from '~/app/components/PluginDetailModal';
import { InstalledPlugin, PluginHealthStatus } from '~/app/types/installed';
import { maintenanceLabelColor, maintenanceDisplayText } from '~/app/utils/maintenance';

const statusConfig: Record<PluginHealthStatus, { label: string; color: 'green' | 'orange' | 'red' | 'grey'; icon: React.ReactElement }> = {
  running: { label: 'Running', color: 'green', icon: <CheckCircleIcon /> },
  degraded: { label: 'Degraded', color: 'orange', icon: <ExclamationTriangleIcon /> },
  stopped: { label: 'Stopped', color: 'red', icon: <ExclamationCircleIcon /> },
  unknown: { label: 'Unknown', color: 'grey', icon: <QuestionCircleIcon /> },
};

const InstalledPage: React.FC = () => {
  const {
    plugins,
    loading,
    healthLoading,
    isRefetching,
    error,
    catalogError,
    refetch,
  } = useInstalledPlugins();

  const { user } = useCurrentUser();
  const isAdmin = user?.isAdmin ?? false;

  const installedNames = useMemo(() => new Set(plugins.map((p) => p.name)), [plugins]);

  const [searchText, setSearchText] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);

  const filteredPlugins = useMemo(() => {
    if (!searchText) return plugins;
    const query = searchText.toLowerCase();
    return plugins.filter((p) => {
      const displayName = p.catalogPlugin?.displayName ?? p.name;
      return (
        displayName.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        (p.catalogPlugin?.description ?? '').toLowerCase().includes(query)
      );
    });
  }, [plugins, searchText]);

  const getRowActions = (plugin: InstalledPlugin): IAction[] => {
    if (!isAdmin) return [];

    const actions: IAction[] = [
      {
        title: 'View details',
        onClick: () => setSelectedPlugin(plugin.name),
      },
    ];

    if (
      plugin.catalogPlugin?.version &&
      plugin.catalogPlugin.version !== '—'
    ) {
      actions.push({
        title: 'Upgrade',
        isDisabled: true,
        tooltipProps: { content: 'Upgrade is not yet available' },
      });
    }

    actions.push(
      { isSeparator: true },
      {
        title: 'Remove',
        isDisabled: true,
        tooltipProps: { content: 'Remove is not yet available' },
      },
    );

    return actions;
  };

  if (loading) {
    return (
      <PageSection>
        <Bullseye>
          <Spinner aria-label="Loading installed plugins" />
        </Bullseye>
      </PageSection>
    );
  }

  if (error && plugins.length === 0) {
    return (
      <PageSection>
        <Alert variant="danger" title="Failed to load installed plugins">
          {error}
        </Alert>
        <Button variant="link" onClick={refetch}>
          Retry
        </Button>
      </PageSection>
    );
  }

  const renderStatusLabel = (plugin: InstalledPlugin) => {
    if (healthLoading) {
      return <Spinner size="sm" aria-label={`Checking ${plugin.name} status`} />;
    }
    const config = statusConfig[plugin.healthStatus];
    return (
      <Label color={config.color} icon={config.icon} isCompact>
        {config.label}
      </Label>
    );
  };

  const renderVersionCell = (plugin: InstalledPlugin) => {
    const latestVersion = plugin.catalogPlugin?.version;
    if (!latestVersion) return '—';
    return latestVersion;
  };

  const toolbar = (
    <Toolbar id="installed-toolbar">
      <ToolbarContent>
        <ToolbarItem>
          <SearchInput
            aria-label="Search installed plugins"
            placeholder="Search by name or description"
            value={searchText}
            onChange={(_event, value) => setSearchText(value)}
            onClear={() => setSearchText('')}
          />
        </ToolbarItem>
        <ToolbarItem>
          <Button
            variant="plain"
            onClick={refetch}
            aria-label="Refresh installed plugins"
            isDisabled={isRefetching}
          >
            Refresh
          </Button>
          {isRefetching && (
            <Spinner
              size="md"
              aria-label="Refreshing installed plugins"
              style={{ marginLeft: 'var(--pf-t--global--spacer--sm)' }}
            />
          )}
        </ToolbarItem>
      </ToolbarContent>
    </Toolbar>
  );

  return (
    <>
      <PageSection>
        <Title headingLevel="h1" className="pf-v6-u-mb-md">
          Installed Plugins
        </Title>
        {catalogError && (
          <Alert
            variant="warning"
            title="Unable to load catalog metadata"
            isInline
            className="pf-v6-u-mb-md"
          >
            Plugin details may be incomplete.
          </Alert>
        )}
        {toolbar}
        {filteredPlugins.length === 0 ? (
          <EmptyState
            titleText={plugins.length === 0 ? 'No plugins installed' : 'No plugins found'}
            headingLevel="h2"
            icon={SearchIcon}
          >
            <EmptyStateBody>
              {plugins.length === 0
                ? 'No community plugins are currently installed. Browse the Catalog to discover and install plugins.'
                : 'No installed plugins match the current search.'}
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <Table aria-label="Installed plugins" variant="compact">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Version</Th>
                <Th>Status</Th>
                <Th>Maintenance</Th>
                {isAdmin && <Th screenReaderText="Actions" />}
              </Tr>
            </Thead>
            <Tbody>
              {filteredPlugins.map((plugin) => {
                const displayName = plugin.catalogPlugin?.displayName ?? plugin.name;
                return (
                  <Tr
                    key={plugin.name}
                    isClickable
                    onRowClick={() => setSelectedPlugin(plugin.name)}
                  >
                    <Td dataLabel="Name">{displayName}</Td>
                    <Td dataLabel="Version">{renderVersionCell(plugin)}</Td>
                    <Td dataLabel="Status">{renderStatusLabel(plugin)}</Td>
                    <Td dataLabel="Maintenance">
                      {plugin.catalogPlugin ? (
                        <Label
                          color={maintenanceLabelColor(plugin.catalogPlugin.maintenance)}
                          isCompact
                        >
                          {maintenanceDisplayText(plugin.catalogPlugin.maintenance)}
                        </Label>
                      ) : (
                        '—'
                      )}
                    </Td>
                    {isAdmin && (
                      <Td isActionCell>
                        <ActionsColumn items={getRowActions(plugin)} />
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </PageSection>
      <PluginDetailModal
        pluginName={selectedPlugin}
        isAdmin={isAdmin}
        installedNames={installedNames}
        installedLoading={loading}
        onClose={() => setSelectedPlugin(null)}
      />
    </>
  );
};

export default InstalledPage;
