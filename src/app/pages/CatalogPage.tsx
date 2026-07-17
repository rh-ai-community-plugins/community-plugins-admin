import React, { useState, useMemo } from 'react';
import {
  PageSection,
  Gallery,
  GalleryItem,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  ToolbarGroup,
  ToolbarFilter,
  ToolbarToggleGroup,
  SearchInput,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  Label,
  LabelGroup,
  Spinner,
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateFooter,
  Badge,
  Button,
  Title,
  Bullseye,
  Alert,
  Flex,
  FlexItem,
  Truncate,
} from '@patternfly/react-core';
import FilterIcon from '@patternfly/react-icons/dist/js/icons/filter-icon';
import SearchIcon from '@patternfly/react-icons/dist/js/icons/search-icon';
import CheckCircleIcon from '@patternfly/react-icons/dist/js/icons/check-circle-icon';
import { useCatalog } from '~/app/hooks/useCatalog';
import { useInstalledPluginNames } from '~/app/hooks/useInstalledPluginNames';
import PluginDetailModal from '~/app/components/PluginDetailModal';
import { CatalogPlugin } from '~/app/types/catalog';
import { maintenanceLabelColor, maintenanceDisplayText } from '~/app/utils/maintenance';

type FilterKey = 'status' | 'maintenance' | 'installState';

const STATUS_OPTIONS = [
  { value: 'experimental', label: 'Experimental' },
  { value: 'stable', label: 'Stable' },
];

const MAINTENANCE_OPTIONS = [
  { value: 'red-hat', label: 'Red Hat' },
  { value: 'community', label: 'Community' },
];

const INSTALL_STATE_OPTIONS = [
  { value: 'installed', label: 'Installed' },
  { value: 'available', label: 'Available' },
];

const statusLabelColor = (status: string): 'blue' | 'green' =>
  status === 'stable' ? 'green' : 'blue';

const CatalogPage: React.FC = () => {
  const { plugins, loading, isRefetching, error, refetch } = useCatalog();
  const { installedNames, loading: installedLoading, error: installedError } = useInstalledPluginNames();

  const [searchText, setSearchText] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [maintenanceFilters, setMaintenanceFilters] = useState<string[]>([]);
  const [installStateFilters, setInstallStateFilters] = useState<string[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);

  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [isInstallStateOpen, setIsInstallStateOpen] = useState(false);

  const filteredPlugins = useMemo(() => {
    return plugins.filter((p) => {
      const matchesSearch =
        !searchText ||
        (p.displayName ?? p.name)
          .toLowerCase()
          .includes(searchText.toLowerCase()) ||
        (p.description ?? '').toLowerCase().includes(searchText.toLowerCase());

      const matchesStatus =
        statusFilters.length === 0 || statusFilters.includes(p.status);

      const matchesMaintenance =
        maintenanceFilters.length === 0 ||
        maintenanceFilters.includes(p.maintenance);

      const isInstalled = installedNames.has(p.name);
      const matchesInstallState =
        installStateFilters.length === 0 ||
        (installStateFilters.includes('installed') && isInstalled) ||
        (installStateFilters.includes('available') && !isInstalled);

      return matchesSearch && matchesStatus && matchesMaintenance && matchesInstallState;
    });
  }, [plugins, searchText, statusFilters, maintenanceFilters, installStateFilters, installedNames]);

  const onDeleteFilter = (category: FilterKey, chip: string) => {
    switch (category) {
      case 'status':
        setStatusFilters((prev) => prev.filter((f) => f !== chip));
        break;
      case 'maintenance':
        setMaintenanceFilters((prev) => prev.filter((f) => f !== chip));
        break;
      case 'installState':
        setInstallStateFilters((prev) => prev.filter((f) => f !== chip));
        break;
    }
  };

  const onDeleteFilterGroup = (category: string) => {
    switch (category) {
      case 'Status':
        setStatusFilters([]);
        break;
      case 'Maintenance':
        setMaintenanceFilters([]);
        break;
      case 'Install state':
        setInstallStateFilters([]);
        break;
    }
  };

  const onClearAllFilters = () => {
    setSearchText('');
    setStatusFilters([]);
    setMaintenanceFilters([]);
    setInstallStateFilters([]);
  };

  const onFilterSelect = (
    filterKey: FilterKey,
    value: string,
    setFilters: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setFilters((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value],
    );
  };

  const renderFilterSelect = (
    filterKey: FilterKey,
    label: string,
    isOpen: boolean,
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>,
    options: { value: string; label: string }[],
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>,
    categoryName: string,
  ) => (
    <ToolbarFilter
      labels={selected.map(
        (s) => options.find((o) => o.value === s)?.label ?? s,
      )}
      deleteLabel={(_category, chip) => {
        const chipStr = typeof chip === 'string' ? chip : chip.key;
        const opt = options.find((o) => o.label === chipStr);
        if (opt) onDeleteFilter(filterKey, opt.value);
      }}
      deleteLabelGroup={() => onDeleteFilterGroup(categoryName)}
      categoryName={categoryName}
    >
      <Select
        aria-label={`${label} filter`}
        isOpen={isOpen}
        selected={selected}
        onSelect={(_event, value) =>
          onFilterSelect(
            filterKey,
            value as string,
            setSelected,
          )
        }
        onOpenChange={setIsOpen}
        toggle={(toggleRef) => (
          <MenuToggle
            ref={toggleRef}
            onClick={() => setIsOpen(!isOpen)}
            isExpanded={isOpen}
          >
            {label}
            {selected.length > 0 && (
              <>{' '}<Badge isRead>{selected.length}</Badge></>
            )}
          </MenuToggle>
        )}
      >
        <SelectList>
          {options.map((opt) => (
            <SelectOption
              key={opt.value}
              value={opt.value}
              hasCheckbox
              isSelected={selected.includes(opt.value)}
            >
              {opt.label}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
    </ToolbarFilter>
  );

  const toolbar = (
    <Toolbar
      id="catalog-toolbar"
      clearAllFilters={onClearAllFilters}
    >
      <ToolbarContent>
        <ToolbarToggleGroup toggleIcon={<FilterIcon />} breakpoint="lg">
          <ToolbarItem>
            <SearchInput
              aria-label="Search plugins"
              placeholder="Search by name or description"
              value={searchText}
              onChange={(_event, value) => setSearchText(value)}
              onClear={() => setSearchText('')}
            />
          </ToolbarItem>
          <ToolbarGroup variant="filter-group">
            {renderFilterSelect(
              'status',
              'Status',
              isStatusOpen,
              setIsStatusOpen,
              STATUS_OPTIONS,
              statusFilters,
              setStatusFilters,
              'Status',
            )}
            {renderFilterSelect(
              'maintenance',
              'Maintenance',
              isMaintenanceOpen,
              setIsMaintenanceOpen,
              MAINTENANCE_OPTIONS,
              maintenanceFilters,
              setMaintenanceFilters,
              'Maintenance',
            )}
            {renderFilterSelect(
              'installState',
              'Install state',
              isInstallStateOpen,
              setIsInstallStateOpen,
              INSTALL_STATE_OPTIONS,
              installStateFilters,
              setInstallStateFilters,
              'Install state',
            )}
          </ToolbarGroup>
        </ToolbarToggleGroup>
        <ToolbarItem>
          <Button variant="plain" onClick={refetch} aria-label="Refresh catalog" isDisabled={isRefetching}>
            Refresh
          </Button>
          {isRefetching && (
            <Spinner size="md" aria-label="Refreshing catalog" style={{ marginLeft: 'var(--pf-t--global--spacer--sm)' }} />
          )}
        </ToolbarItem>
      </ToolbarContent>
    </Toolbar>
  );

  const renderPluginCard = (plugin: CatalogPlugin) => {
    const isInstalled = installedNames.has(plugin.name);
    const displayName = plugin.displayName ?? plugin.name;
    return (
      <GalleryItem key={plugin.name}>
        <Card isClickable>
          <CardHeader
            selectableActions={{
              onClickAction: () => setSelectedPlugin(plugin.name),
              selectableActionAriaLabel: `View details for ${displayName}`,
            }}
          >
            <Flex
              justifyContent={{ default: 'justifyContentSpaceBetween' }}
              alignItems={{ default: 'alignItemsCenter' }}
              className="pf-v6-u-w-100"
            >
              <FlexItem>
                <CardTitle>{displayName}</CardTitle>
              </FlexItem>
              {isInstalled && (
                <FlexItem>
                  <Label color="green" icon={<CheckCircleIcon />} isCompact>
                    Installed
                  </Label>
                </FlexItem>
              )}
            </Flex>
          </CardHeader>
          <CardBody>
            {plugin.description && (
              <div className="pf-v6-u-mb-sm">
                <Truncate content={plugin.description} />
              </div>
            )}
            {!plugin.metadataAvailable && (
              <div className="pf-v6-u-mb-sm" style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>
                Metadata unavailable
              </div>
            )}
            {plugin.version && (
              <div className="pf-v6-u-mb-sm pf-v6-u-font-size-sm" style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>
                Version {plugin.version}
              </div>
            )}
          </CardBody>
          <CardFooter>
            <LabelGroup>
              <Label color={statusLabelColor(plugin.status)} isCompact>
                {plugin.status === 'stable' ? 'Stable' : 'Experimental'}
              </Label>
              <Label color={maintenanceLabelColor(plugin.maintenance)} isCompact>
                {maintenanceDisplayText(plugin.maintenance)}
              </Label>
              {plugin.deploymentModel && (
                <Label color="grey" isCompact>
                  {plugin.deploymentModel}
                </Label>
              )}
            </LabelGroup>
          </CardFooter>
        </Card>
      </GalleryItem>
    );
  };

  if (loading || installedLoading) {
    return (
      <PageSection>
        <Bullseye>
          <Spinner aria-label="Loading catalog" />
        </Bullseye>
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection>
        <Alert variant="danger" title="Failed to load catalog">
          {error}
        </Alert>
        <Button variant="link" onClick={refetch}>
          Retry
        </Button>
      </PageSection>
    );
  }

  return (
    <>
      <PageSection>
        <Title headingLevel="h1" className="pf-v6-u-mb-md">
          Catalog
        </Title>
        {installedError && (
          <Alert
            variant="warning"
            title="Unable to determine installed plugin status"
            isInline
            className="pf-v6-u-mb-md"
          >
            Install badges may be incomplete.
          </Alert>
        )}
        {toolbar}
        {filteredPlugins.length === 0 ? (
          <EmptyState
            titleText="No plugins found"
            headingLevel="h2"
            icon={SearchIcon}
          >
            <EmptyStateBody>
              {plugins.length === 0
                ? 'The plugin catalog is empty.'
                : 'No plugins match the current filters.'}
            </EmptyStateBody>
            {plugins.length > 0 && (
              <EmptyStateFooter>
                <EmptyStateActions>
                  <Button variant="link" onClick={onClearAllFilters}>
                    Clear all filters
                  </Button>
                </EmptyStateActions>
              </EmptyStateFooter>
            )}
          </EmptyState>
        ) : (
          <Gallery hasGutter minWidths={{ default: '300px' }}>
            {filteredPlugins.map(renderPluginCard)}
          </Gallery>
        )}
      </PageSection>
      <PluginDetailModal
        pluginName={selectedPlugin}
        onClose={() => setSelectedPlugin(null)}
      />
    </>
  );
};

export default CatalogPage;
