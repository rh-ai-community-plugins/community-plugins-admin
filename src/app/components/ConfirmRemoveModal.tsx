import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Button,
  TextInput,
  Alert,
  FormGroup,
  Form,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';

interface ConfirmRemoveModalProps {
  pluginName: string | null;
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: (deleteNamespace: boolean) => void;
  onCancel: () => void;
}

const ConfirmRemoveModal: React.FC<ConfirmRemoveModalProps> = ({
  pluginName,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}) => {
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    setConfirmText('');
  }, [pluginName]);

  const isMatch = confirmText === pluginName;

  const handleConfirm = () => {
    if (!isMatch) return;
    onConfirm(false);
  };

  const handleClose = () => {
    setConfirmText('');
    onCancel();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      variant="small"
      aria-label="Confirm plugin removal"
    >
      <ModalHeader title="Remove plugin" />
      <ModalBody>
        <Alert
          variant="warning"
          title="This action cannot be undone"
          isInline
          className="pf-v6-u-mb-md"
        >
          Removing this plugin will uninstall its Helm release and remove it from the dashboard.
        </Alert>
        <Form>
          <FormGroup
            label={`Type "${pluginName}" to confirm removal`}
            isRequired
            fieldId="confirm-remove-input"
          >
            <TextInput
              id="confirm-remove-input"
              value={confirmText}
              onChange={(_event, value) => setConfirmText(value)}
              aria-label="Confirm plugin name"
              isDisabled={isLoading}
            />
            {confirmText.length > 0 && !isMatch && (
              <HelperText>
                <HelperTextItem variant="error">
                  Name does not match
                </HelperTextItem>
              </HelperText>
            )}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="danger"
          onClick={handleConfirm}
          isDisabled={!isMatch}
          isLoading={isLoading}
        >
          Remove
        </Button>
        <Button variant="link" onClick={handleClose} isDisabled={isLoading}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default ConfirmRemoveModal;
