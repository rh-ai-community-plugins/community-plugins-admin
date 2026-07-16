import React from 'react';
import { Modal, ModalBody, ModalHeader } from '@patternfly/react-core';

interface PluginDetailModalProps {
  pluginName: string | null;
  onClose: () => void;
}

const PluginDetailModal: React.FC<PluginDetailModalProps> = ({
  pluginName,
  onClose,
}) => (
  <Modal isOpen={!!pluginName} onClose={onClose} variant="large">
    <ModalHeader title={pluginName ?? ''} />
    <ModalBody>Plugin detail content coming soon.</ModalBody>
  </Modal>
);

export default PluginDetailModal;
