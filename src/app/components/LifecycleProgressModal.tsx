import React from 'react';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Button,
  Alert,
  ProgressStep,
  ProgressStepper,
} from '@patternfly/react-core';
import { LifecycleStep, LifecycleOperation } from '~/app/types/lifecycle';

interface LifecycleProgressModalProps {
  isOpen: boolean;
  operation: LifecycleOperation | null;
  steps: LifecycleStep[];
  success: boolean | null;
  message: string | null;
  onClose: () => void;
}

const operationTitle: Record<LifecycleOperation, string> = {
  install: 'Installing plugin',
  upgrade: 'Upgrading plugin',
  remove: 'Removing plugin',
  enable: 'Enabling plugin',
  disable: 'Disabling plugin',
};

const operationSuccessTitle: Record<LifecycleOperation, string> = {
  install: 'Plugin installed',
  upgrade: 'Plugin upgraded',
  remove: 'Plugin removed',
  enable: 'Plugin enabled',
  disable: 'Plugin disabled',
};

function stepVariant(status: LifecycleStep['status']): 'success' | 'info' | 'pending' | 'danger' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
      return 'info';
    case 'failed':
      return 'danger';
    default:
      return 'pending';
  }
}

const LifecycleProgressModal: React.FC<LifecycleProgressModalProps> = ({
  isOpen,
  operation,
  steps,
  success,
  message,
  onClose,
}) => {
  if (!operation) return null;

  const inProgress = success === null;
  const title = inProgress
    ? operationTitle[operation]
    : success
      ? operationSuccessTitle[operation]
      : `${operationTitle[operation]} failed`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={inProgress ? undefined : onClose}
      variant="medium"
      aria-label={title}
    >
      <ModalHeader title={title} />
      <ModalBody>
        {steps.length > 0 && (
          <ProgressStepper isVertical>
            {steps.map((step) => (
              <ProgressStep
                key={step.id}
                variant={stepVariant(step.status)}
                isCurrent={step.status === 'running'}
                id={step.id}
                titleId={`${step.id}-title`}
                aria-label={step.label}
                description={step.error}
              >
                {step.label}
              </ProgressStep>
            ))}
          </ProgressStepper>
        )}
        {success === false && message && (
          <Alert
            variant="danger"
            title="Operation failed"
            isInline
            className="pf-v6-u-mt-md"
          >
            {message}
          </Alert>
        )}
        {success === true && message && (
          <Alert
            variant="success"
            title={message}
            isInline
            className="pf-v6-u-mt-md"
          />
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={onClose}
          isDisabled={inProgress}
        >
          {success ? 'Done' : 'Close'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default LifecycleProgressModal;
