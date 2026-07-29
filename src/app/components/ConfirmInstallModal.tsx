import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Button,
  TextInput,
  FormGroup,
  Form,
  HelperText,
  HelperTextItem,
  Checkbox,
} from '@patternfly/react-core';

const K8S_NAMESPACE_PATTERN = /^[a-z][a-z0-9-]{0,62}[a-z0-9]$/;

interface ConfirmInstallModalProps {
  pluginName: string | null;
  defaultNamespace: string;
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: (namespace: string) => void;
  onCancel: () => void;
}

const ConfirmInstallModal: React.FC<ConfirmInstallModalProps> = ({
  pluginName,
  defaultNamespace,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}) => {
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [namespaceInput, setNamespaceInput] = useState(defaultNamespace);

  useEffect(() => {
    setOverrideEnabled(false);
    setNamespaceInput(defaultNamespace);
  }, [pluginName, defaultNamespace]);

  const effectiveNamespace = overrideEnabled ? namespaceInput : defaultNamespace;
  const isValid = K8S_NAMESPACE_PATTERN.test(effectiveNamespace);
  const showError = overrideEnabled && namespaceInput.length > 0 && !K8S_NAMESPACE_PATTERN.test(namespaceInput);

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(effectiveNamespace);
  };

  const handleClose = () => {
    setOverrideEnabled(false);
    setNamespaceInput(defaultNamespace);
    onCancel();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      variant="small"
      aria-label="Confirm plugin installation"
    >
      <ModalHeader title="Install plugin" />
      <ModalBody>
        <p className="pf-v6-u-mb-md">
          This plugin will be installed in namespace <strong>{defaultNamespace}</strong>.
        </p>
        <Form>
          <Checkbox
            id="override-namespace-checkbox"
            label="Install in a different namespace"
            isChecked={overrideEnabled}
            onChange={(_event, checked) => setOverrideEnabled(checked)}
            isDisabled={isLoading}
          />
          {overrideEnabled && (
            <FormGroup
              label="Namespace"
              fieldId="namespace-override-input"
              className="pf-v6-u-ml-lg"
            >
              <TextInput
                id="namespace-override-input"
                value={namespaceInput}
                onChange={(_event, value) => setNamespaceInput(value)}
                aria-label="Namespace"
                isDisabled={isLoading}
              />
              {showError ? (
                <HelperText>
                  <HelperTextItem variant="error">
                    Must start with a letter, contain only lowercase letters, digits, or hyphens, and end with a letter or digit.
                  </HelperTextItem>
                </HelperText>
              ) : (
                <HelperText>
                  <HelperTextItem variant="indeterminate">
                    Use a &quot;cp-&quot; prefix for consistency (e.g. cp-{pluginName}).
                  </HelperTextItem>
                </HelperText>
              )}
            </FormGroup>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={handleConfirm}
          isDisabled={!isValid}
          isLoading={isLoading}
        >
          Install
        </Button>
        <Button variant="link" onClick={handleClose} isDisabled={isLoading}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default ConfirmInstallModal;
