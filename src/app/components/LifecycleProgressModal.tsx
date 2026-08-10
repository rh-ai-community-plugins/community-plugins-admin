import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Button,
  Alert,
  ProgressStep,
  ProgressStepper,
  Spinner,
} from '@patternfly/react-core';
import { LifecycleStep, LifecycleOperation } from '~/app/types/lifecycle';
import { useDashboardStatus } from '~/app/contexts/DashboardStatusContext';
import DashboardRestartBanner from '~/app/components/DashboardRestartBanner';

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function useElapsedTime(runningStepId: string | undefined): number {
  const [elapsed, setElapsed] = useState(0);
  const prevStepId = useRef(runningStepId);

  useEffect(() => {
    if (runningStepId !== prevStepId.current) {
      setElapsed(0);
      prevStepId.current = runningStepId;
    }

    if (!runningStepId) return;

    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [runningStepId]);

  return elapsed;
}

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

const CONFIG_CHANGING_OPS = new Set<LifecycleOperation>(['install', 'remove', 'enable', 'disable']);

const LifecycleProgressModal: React.FC<LifecycleProgressModalProps> = ({
  isOpen,
  operation,
  steps,
  success,
  message,
  onClose,
}) => {
  const { startMonitoring } = useDashboardStatus();
  const triggersRestart = operation !== null && CONFIG_CHANGING_OPS.has(operation);

  useEffect(() => {
    if (success === true && triggersRestart && operation) {
      startMonitoring(operation);
    }
  }, [success, triggersRestart, operation, startMonitoring]);

  const runningStepId = steps.find((s) => s.status === 'running')?.id;
  const elapsed = useElapsedTime(runningStepId);

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
        <div aria-live="polite" aria-atomic="false" className="pf-v6-screen-reader">
          {steps.filter((s) => s.status === 'running').map((s) => s.label).join(', ')}
        </div>
        {steps.length > 0 && (
          <ProgressStepper isVertical>
            {steps.map((step) => {
              const isRunning = step.status === 'running';
              const description = step.error ?? (isRunning ? formatElapsed(elapsed) : undefined);
              return (
                <ProgressStep
                  key={step.id}
                  variant={stepVariant(step.status)}
                  isCurrent={isRunning}
                  id={step.id}
                  titleId={`${step.id}-title`}
                  aria-label={step.label}
                  description={description}
                  icon={isRunning ? <Spinner size="md" /> : undefined}
                >
                  {step.label}
                </ProgressStep>
              );
            })}
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
        {success === true && triggersRestart && (
          <DashboardRestartBanner className="pf-v6-u-mt-md" />
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={inProgress ? undefined : onClose}
          isAriaDisabled={inProgress}
        >
          {success ? 'Done' : 'Close'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default LifecycleProgressModal;
