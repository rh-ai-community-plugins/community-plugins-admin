import React, { useState } from 'react';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Button,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Label,
  LabelGroup,
  Spinner,
  Alert,
  Flex,
  FlexItem,
  List,
  ListItem,
  Bullseye,
  Split,
  SplitItem,
  Tooltip,
} from '@patternfly/react-core';
import ExternalLinkAltIcon from '@patternfly/react-icons/dist/js/icons/external-link-alt-icon';
import BanIcon from '@patternfly/react-icons/dist/js/icons/ban-icon';
import { usePluginDetail } from '~/app/hooks/usePluginDetail';
import { usePluginLifecycle } from '~/app/hooks/usePluginLifecycle';
import { CatalogPlugin } from '~/app/types/catalog';
import {
  maintenanceLabelColor,
  maintenanceDisplayText,
  statusLabelColor,
  deploymentModelLabel,
} from '~/app/utils/maintenance';
import ConfirmRemoveModal from '~/app/components/ConfirmRemoveModal';
import LifecycleProgressModal from '~/app/components/LifecycleProgressModal';

interface PluginDetailModalProps {
  pluginName: string | null;
  isAdmin: boolean;
  installedNames: Set<string>;
  installedLoading: boolean;
  /** Names of plugins with an existing Helm release (may include disabled plugins). */
  helmInstalledNames?: Set<string>;
  onClose: () => void;
  onLifecycleComplete?: () => void;
}

const isSafeUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const installMethodLabel = (method: string): string => {
  switch (method) {
    case 'automatic':
      return 'Automatic';
    case 'assisted':
      return 'Assisted';
    case 'manual':
      return 'Manual';
    default:
      return method;
  }
};

const PluginDetailContent: React.FC<{
  plugin: CatalogPlugin;
  installed: boolean;
  disabled: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onInstall: () => void;
  onUpgrade: () => void;
  onRemove: () => void;
  onDisable: () => void;
  onEnable: () => void;
  lifecycleLoading: boolean;
}> = ({ plugin, installed, disabled, isAdmin, onClose, onInstall, onUpgrade, onRemove, onDisable, onEnable, lifecycleLoading }) => {
  const displayName = plugin.displayName ?? plugin.name;

  return (
    <>
      <ModalHeader
        title={displayName}
        description={
          <Flex gap={{ default: 'gapSm' }} className="pf-v6-u-mt-sm">
            {plugin.version && (
              <FlexItem>
                <Label isCompact>v{plugin.version}</Label>
              </FlexItem>
            )}
            <FlexItem>
              <Label color={statusLabelColor(plugin.status)} isCompact>
                {plugin.status === 'stable' ? 'Stable' : 'Experimental'}
              </Label>
            </FlexItem>
            <FlexItem>
              <Label color={maintenanceLabelColor(plugin.maintenance)} isCompact>
                {maintenanceDisplayText(plugin.maintenance)}
              </Label>
            </FlexItem>
            {installed && (
              <FlexItem>
                <Label color="green" isCompact>
                  Installed
                </Label>
              </FlexItem>
            )}
            {disabled && (
              <FlexItem>
                <Label color="orange" icon={<BanIcon />} isCompact>
                  Disabled
                </Label>
              </FlexItem>
            )}
          </Flex>
        }
      />
      <ModalBody>
        <DescriptionList isHorizontal>
          {plugin.description && (
            <DescriptionListGroup>
              <DescriptionListTerm>Description</DescriptionListTerm>
              <DescriptionListDescription>{plugin.description}</DescriptionListDescription>
            </DescriptionListGroup>
          )}

          {plugin.maintainer && (
            <DescriptionListGroup>
              <DescriptionListTerm>Maintainer</DescriptionListTerm>
              <DescriptionListDescription>
                {plugin.maintainer.github ? (
                  <Button
                    variant="link"
                    isInline
                    component="a"
                    href={`https://github.com/${plugin.maintainer.github}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    icon={<ExternalLinkAltIcon />}
                    iconPosition="end"
                  >
                    {plugin.maintainer.name}
                  </Button>
                ) : (
                  plugin.maintainer.name
                )}
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}

          {plugin.rhoaiCompatibility && (
            <DescriptionListGroup>
              <DescriptionListTerm>RHOAI Compatibility</DescriptionListTerm>
              <DescriptionListDescription>
                {plugin.rhoaiCompatibility.minVersion && (
                  <div>Min version: {plugin.rhoaiCompatibility.minVersion}</div>
                )}
                {plugin.rhoaiCompatibility.testedVersions &&
                  plugin.rhoaiCompatibility.testedVersions.length > 0 && (
                    <div>
                      Tested:{' '}
                      <LabelGroup>
                        {plugin.rhoaiCompatibility.testedVersions.map((v) => (
                          <Label key={v} isCompact>
                            {v}
                          </Label>
                        ))}
                      </LabelGroup>
                    </div>
                  )}
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}

          {plugin.deploymentModel && (
            <DescriptionListGroup>
              <DescriptionListTerm>Deployment Model</DescriptionListTerm>
              <DescriptionListDescription>
                {deploymentModelLabel(plugin.deploymentModel)}
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}

          {(plugin.image?.repository || plugin.bffImage?.repository) && (
            <DescriptionListGroup>
              <DescriptionListTerm>Container Images</DescriptionListTerm>
              <DescriptionListDescription>
                <List isPlain>
                  {plugin.image?.repository && (
                    <ListItem>
                      <Split hasGutter>
                        <SplitItem>Frontend:</SplitItem>
                        <SplitItem>
                          <code>{plugin.image.repository}:{plugin.image.tag ?? 'latest'}</code>
                        </SplitItem>
                      </Split>
                    </ListItem>
                  )}
                  {plugin.bffImage?.repository && (
                    <ListItem>
                      <Split hasGutter>
                        <SplitItem>BFF:</SplitItem>
                        <SplitItem>
                          <code>{plugin.bffImage.repository}:{plugin.bffImage.tag ?? 'latest'}</code>
                        </SplitItem>
                      </Split>
                    </ListItem>
                  )}
                </List>
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}

          {plugin.install && (
            <DescriptionListGroup>
              <DescriptionListTerm>Install Method</DescriptionListTerm>
              <DescriptionListDescription>
                <div>{installMethodLabel(plugin.install.method)}</div>
                {plugin.install.helm?.registry && (
                  <div className="pf-v6-u-mt-xs">
                    Helm registry: <code>{plugin.install.helm.registry}</code>
                  </div>
                )}
                {plugin.install.helm?.chartPath && (
                  <div className="pf-v6-u-mt-xs">
                    Chart path: <code>{plugin.install.helm.chartPath}</code>
                  </div>
                )}
                {plugin.install.prerequisites && plugin.install.prerequisites.length > 0 && (
                  <div className="pf-v6-u-mt-sm">
                    <strong>Prerequisites:</strong>
                    <List>
                      {plugin.install.prerequisites.map((prereq, i) => (
                        <ListItem key={i}>{prereq}</ListItem>
                      ))}
                    </List>
                  </div>
                )}
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}

          {plugin.rbac && (
            <DescriptionListGroup>
              <DescriptionListTerm>RBAC Requirements</DescriptionListTerm>
              <DescriptionListDescription>
                {plugin.rbac.clusterRoles && (
                  <div>Requires cluster-level roles</div>
                )}
                {plugin.rbac.requiredRoles && plugin.rbac.requiredRoles.length > 0 && (
                  <LabelGroup>
                    {plugin.rbac.requiredRoles.map((role) => (
                      <Label key={role} isCompact>
                        {role}
                      </Label>
                    ))}
                  </LabelGroup>
                )}
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}

          {plugin.support && (
            <DescriptionListGroup>
              <DescriptionListTerm>Support</DescriptionListTerm>
              <DescriptionListDescription>
                <Flex gap={{ default: 'gapMd' }}>
                  {plugin.support.repo && isSafeUrl(plugin.support.repo) && (
                    <FlexItem>
                      <Button
                        variant="link"
                        isInline
                        component="a"
                        href={plugin.support.repo}
                        target="_blank"
                        rel="noopener noreferrer"
                        icon={<ExternalLinkAltIcon />}
                        iconPosition="end"
                      >
                        Repository
                      </Button>
                    </FlexItem>
                  )}
                  {plugin.support.docs && isSafeUrl(plugin.support.docs) && (
                    <FlexItem>
                      <Button
                        variant="link"
                        isInline
                        component="a"
                        href={plugin.support.docs}
                        target="_blank"
                        rel="noopener noreferrer"
                        icon={<ExternalLinkAltIcon />}
                        iconPosition="end"
                      >
                        Documentation
                      </Button>
                    </FlexItem>
                  )}
                  {plugin.support.issues && isSafeUrl(plugin.support.issues) && (
                    <FlexItem>
                      <Button
                        variant="link"
                        isInline
                        component="a"
                        href={plugin.support.issues}
                        target="_blank"
                        rel="noopener noreferrer"
                        icon={<ExternalLinkAltIcon />}
                        iconPosition="end"
                      >
                        Issues
                      </Button>
                    </FlexItem>
                  )}
                </Flex>
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
        </DescriptionList>
      </ModalBody>
      <ModalFooter>
        <Flex gap={{ default: 'gapSm' }}>
          {isAdmin && disabled && (
            <>
              <FlexItem>
                <Button
                  variant="primary"
                  onClick={onEnable}
                  isDisabled={lifecycleLoading}
                  isLoading={lifecycleLoading}
                >
                  Enable
                </Button>
              </FlexItem>
              <FlexItem>
                <Button
                  variant="danger"
                  onClick={onRemove}
                  isDisabled={lifecycleLoading}
                >
                  Remove
                </Button>
              </FlexItem>
            </>
          )}
          {isAdmin && !installed && !disabled && plugin.install?.method === 'automatic' && (
            <FlexItem>
              <Button
                variant="primary"
                onClick={onInstall}
                isDisabled={lifecycleLoading}
                isLoading={lifecycleLoading}
              >
                Install
              </Button>
            </FlexItem>
          )}
          {isAdmin && !installed && !disabled && plugin.install?.method === 'assisted' && (
            <FlexItem>
              <Button
                variant="primary"
                onClick={onInstall}
                isDisabled={lifecycleLoading}
                isLoading={lifecycleLoading}
              >
                Install (Assisted)
              </Button>
            </FlexItem>
          )}
          {isAdmin && installed && (
            <>
              <FlexItem>
                <Button
                  variant="primary"
                  onClick={onUpgrade}
                  isDisabled={lifecycleLoading}
                >
                  Upgrade
                </Button>
              </FlexItem>
              <FlexItem>
                <Button
                  variant="secondary"
                  onClick={onDisable}
                  isDisabled={lifecycleLoading}
                >
                  Disable
                </Button>
              </FlexItem>
              <FlexItem>
                <Button
                  variant="danger"
                  onClick={onRemove}
                  isDisabled={lifecycleLoading}
                >
                  Remove
                </Button>
              </FlexItem>
            </>
          )}
          {isAdmin && !installed && !disabled && plugin.install?.method === 'manual' && plugin.install.instructions && isSafeUrl(plugin.install.instructions) && (
            <FlexItem>
              <Button
                variant="primary"
                component="a"
                href={plugin.install.instructions}
                target="_blank"
                rel="noopener noreferrer"
              >
                View install instructions
              </Button>
            </FlexItem>
          )}
          {isAdmin && !installed && !disabled && !plugin.install && (
            <FlexItem>
              <Tooltip content="Install configuration is not available for this plugin.">
                <Button variant="primary" isAriaDisabled>
                  Install
                </Button>
              </Tooltip>
            </FlexItem>
          )}
          <FlexItem>
            <Button variant="link" onClick={onClose}>
              Close
            </Button>
          </FlexItem>
        </Flex>
      </ModalFooter>
    </>
  );
};

const PluginDetailModal: React.FC<PluginDetailModalProps> = ({
  pluginName,
  isAdmin,
  installedNames,
  installedLoading,
  helmInstalledNames,
  onClose,
  onLifecycleComplete,
}) => {
  const { plugin, installed, loading, error } = usePluginDetail(pluginName, installedNames, installedLoading);
  const lifecycle = usePluginLifecycle();

  const disabled = !installed && !!pluginName && !!(helmInstalledNames?.has(pluginName));

  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const handleLifecycleComplete = () => {
    setShowProgress(false);
    lifecycle.reset();
    onLifecycleComplete?.();
  };

  const handleInstall = async () => {
    if (!pluginName) return;
    setShowProgress(true);
    await lifecycle.install(pluginName);
  };

  const handleUpgrade = async () => {
    if (!pluginName) return;
    setShowProgress(true);
    await lifecycle.upgrade(pluginName);
  };

  const handleRemoveConfirm = async (deleteNamespace: boolean) => {
    if (!pluginName) return;
    setShowRemoveConfirm(false);
    setShowProgress(true);
    await lifecycle.remove(pluginName, deleteNamespace);
  };

  const handleDisable = async () => {
    if (!pluginName) return;
    setShowProgress(true);
    await lifecycle.disable(pluginName);
  };

  const handleEnable = async () => {
    if (!pluginName) return;
    setShowProgress(true);
    await lifecycle.enable(pluginName);
  };

  return (
    <>
      <Modal isOpen={!!pluginName} onClose={onClose} variant="large" aria-label="Plugin details">
        {loading && (
          <>
            <ModalHeader title={pluginName ?? ''} />
            <ModalBody>
              <Bullseye>
                <Spinner aria-label="Loading plugin details" />
              </Bullseye>
            </ModalBody>
          </>
        )}
        {!loading && error && (
          <>
            <ModalHeader title={pluginName ?? ''} />
            <ModalBody>
              <Alert variant="danger" title="Failed to load plugin details" isInline>
                {error}
              </Alert>
            </ModalBody>
          </>
        )}
        {!loading && !error && plugin && (
          <PluginDetailContent
            plugin={plugin}
            installed={installed}
            disabled={disabled}
            isAdmin={isAdmin}
            onClose={onClose}
            onInstall={handleInstall}
            onUpgrade={handleUpgrade}
            onRemove={() => setShowRemoveConfirm(true)}
            onDisable={handleDisable}
            onEnable={handleEnable}
            lifecycleLoading={lifecycle.loading}
          />
        )}
        {!loading && !error && !plugin && pluginName && (
          <>
            <ModalHeader title={pluginName ?? ''} />
            <ModalBody>
              <Alert variant="warning" title="Plugin not found" isInline>
                Could not find details for plugin &quot;{pluginName}&quot;.
              </Alert>
            </ModalBody>
          </>
        )}
      </Modal>
      <ConfirmRemoveModal
        pluginName={pluginName}
        isOpen={showRemoveConfirm}
        isLoading={lifecycle.loading}
        onConfirm={handleRemoveConfirm}
        onCancel={() => setShowRemoveConfirm(false)}
      />
      <LifecycleProgressModal
        isOpen={showProgress}
        operation={lifecycle.operation}
        steps={lifecycle.result?.steps ?? []}
        success={lifecycle.loading ? null : lifecycle.result?.success ?? null}
        message={lifecycle.result?.message ?? null}
        onClose={handleLifecycleComplete}
      />
    </>
  );
};

export default PluginDetailModal;
