import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { LifecycleOperation } from '~/app/types/lifecycle';
import { useDashboardRollout, DashboardRolloutState } from '~/app/hooks/useDashboardRollout';

interface DashboardStatusContextValue {
  isMonitoring: boolean;
  operation: LifecycleOperation | null;
  status: DashboardRolloutState | null;
  loading: boolean;
  consecutiveErrors: number;
  startMonitoring: (operation: LifecycleOperation) => void;
  stopMonitoring: () => void;
}

const DashboardStatusContext = createContext<DashboardStatusContextValue>({
  isMonitoring: false,
  operation: null,
  status: null,
  loading: false,
  consecutiveErrors: 0,
  startMonitoring: () => {},
  stopMonitoring: () => {},
});

export const DashboardStatusProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [operation, setOperation] = useState<LifecycleOperation | null>(null);
  const { status, loading, consecutiveErrors } = useDashboardRollout(isMonitoring);

  const startMonitoring = useCallback((op: LifecycleOperation) => {
    setOperation(op);
    setIsMonitoring(true);
  }, []);
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    setOperation(null);
  }, []);

  const value = useMemo(
    () => ({ isMonitoring, operation, status, loading, consecutiveErrors, startMonitoring, stopMonitoring }),
    [isMonitoring, operation, status, loading, consecutiveErrors, startMonitoring, stopMonitoring],
  );

  return (
    <DashboardStatusContext.Provider value={value}>
      {children}
    </DashboardStatusContext.Provider>
  );
};

export function useDashboardStatus(): DashboardStatusContextValue {
  return useContext(DashboardStatusContext);
}
