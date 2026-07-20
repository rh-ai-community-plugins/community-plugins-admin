import React, { useEffect, useState } from 'react';
import { Alert, AlertActionCloseButton } from '@patternfly/react-core';
import { LifecycleOperation } from '~/app/types/lifecycle';
import { useDashboardStatus } from '~/app/contexts/DashboardStatusContext';

interface DashboardRestartBannerProps {
  className?: string;
}

const AUTO_DISMISS_MS = 8000;

const completionTitle: Record<LifecycleOperation, string> = {
  install: 'Plugin ready',
  upgrade: 'Plugin upgraded',
  remove: 'Plugin removed successfully',
  enable: 'Plugin ready',
  disable: 'Plugin disabled successfully',
};

const DashboardRestartBanner: React.FC<DashboardRestartBannerProps> = ({ className }) => {
  const { isMonitoring, operation, status, loading, consecutiveErrors, stopMonitoring } = useDashboardStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (status?.rolloutStatus !== 'complete') return;
    const timer = setTimeout(() => {
      setDismissed(true);
      stopMonitoring();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [status?.rolloutStatus, stopMonitoring]);

  useEffect(() => {
    if (isMonitoring) setDismissed(false);
  }, [isMonitoring]);

  if (!isMonitoring || dismissed) return null;

  const dismiss = () => { setDismissed(true); stopMonitoring(); };

  if (loading && !status) {
    return (
      <Alert variant="info" title="Checking dashboard status…" isInline className={className} />
    );
  }

  if (consecutiveErrors >= 3 && !status) {
    return (
      <Alert
        variant="warning"
        title="Unable to reach dashboard"
        isInline
        className={className}
        actionClose={<AlertActionCloseButton onClose={dismiss} />}
      >
        The dashboard may be restarting. Status will update automatically when it becomes available.
      </Alert>
    );
  }

  if (!status) return null;

  if (status.rolloutStatus === 'complete') {
    const title = operation ? completionTitle[operation] : 'Dashboard restart complete';
    return (
      <Alert
        variant="success"
        title={title}
        isInline
        className={className}
        actionClose={<AlertActionCloseButton onClose={dismiss} />}
      />
    );
  }

  if (status.rolloutStatus === 'error') {
    return (
      <Alert
        variant="warning"
        title="Dashboard restart may have stalled"
        isInline
        className={className}
        actionClose={<AlertActionCloseButton onClose={dismiss} />}
      >
        {status.message}
      </Alert>
    );
  }

  return (
    <Alert
      variant="info"
      title={status.message}
      isInline
      className={className}
    />
  );
};

export default DashboardRestartBanner;
