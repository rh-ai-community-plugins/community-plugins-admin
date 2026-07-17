import React from 'react';
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
import { usePluginDetail } from '~/app/hooks/usePluginDetail';
import { CatalogPlugin } from '~/app/types/catalog';
import {
  maintenanceLabelColor,
  maintenanceDisplayText,
  statusLabelColor,
} from '~/app/utils/maintenance';

interface PluginDetailModalProps {
  pluginName: string | null;
  isAdmin: boolean;
  onClose: () => void;
}

const isSafeUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const deploymentModelLabel = (model: string): string => {
  switch (model) {
    case 'cluster-shared':
      return 'Cluster-shared';
    case 'per-project':
      return 'Per-project';
    case 'both':
      return 'Cluster-shared / Per-project';
    default:
      return model;
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
  isAdmin: boolean;
  onClose: () => void;
}> = ({ plugin, installed, isAdmin, onClose }) => {
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

          {(plugin.image || plugin.bffImage) && (
            <DescriptionListGroup>
              <DescriptionListTerm>Container Images</DescriptionListTerm>
              <DescriptionListDescription>
                <List isPlain>
                  {plugin.image && (
                    <ListItem>
                      <Split hasGutter>
                        <SplitItem>Frontend:</SplitItem>
                        <SplitItem>
                          <code>{plugin.image.repository}:{plugin.image.tag}</code>
                        </SplitItem>
                      </Split>
                    </ListItem>
                  )}
                  {plugin.bffImage && (
                    <ListItem>
                      <Split hasGutter>
                        <SplitItem>BFF:</SplitItem>
                        <SplitItem>
                          <code>{plugin.bffImage.repository}:{plugin.bffImage.tag}</code>
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
          {isAdmin && !installed && (
            <FlexItem>
              <Tooltip content="Install is not yet available">
                <Button variant="primary" isAriaDisabled>
                  Install
                </Button>
              </Tooltip>
            </FlexItem>
          )}
          {isAdmin && installed && (
            <>
              <FlexItem>
                <Tooltip content="Upgrade is not yet available">
                  <Button variant="primary" isAriaDisabled>
                    Upgrade
                  </Button>
                </Tooltip>
              </FlexItem>
              <FlexItem>
                <Tooltip content="Enable/Disable is not yet available">
                  <Button variant="secondary" isAriaDisabled>
                    Disable
                  </Button>
                </Tooltip>
              </FlexItem>
              <FlexItem>
                <Tooltip content="Remove is not yet available">
                  <Button variant="danger" isAriaDisabled>
                    Remove
                  </Button>
                </Tooltip>
              </FlexItem>
            </>
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
  onClose,
}) => {
  const { plugin, installed, loading, error } = usePluginDetail(pluginName);

  return (
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
      {error && (
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
          isAdmin={isAdmin}
          onClose={onClose}
        />
      )}
    </Modal>
  );
};

export default PluginDetailModal;
