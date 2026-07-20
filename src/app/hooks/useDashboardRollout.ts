import { useState, useEffect, useRef, useCallback } from 'react';

export type RolloutStatus = 'progressing' | 'complete' | 'error';

export interface DashboardRolloutState {
  rolloutStatus: RolloutStatus;
  replicas: number;
  readyReplicas: number;
  updatedReplicas: number;
  availableReplicas: number;
  message: string;
}

const POLL_INTERVAL_MS = 5000;

export function useDashboardRollout(active: boolean): {
  status: DashboardRolloutState | null;
  loading: boolean;
  consecutiveErrors: number;
} {
  const [status, setStatus] = useState<DashboardRolloutState | null>(null);
  const [loading, setLoading] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const completedRef = useRef(false);

  const fetchStatus = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await fetch('/community-plugins-admin/api/dashboard/status', { signal });
      if (!res.ok) {
        setConsecutiveErrors((c) => c + 1);
        return;
      }
      const data: DashboardRolloutState = await res.json();
      setStatus(data);
      setConsecutiveErrors(0);
      if (data.rolloutStatus === 'complete') {
        completedRef.current = true;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setConsecutiveErrors((c) => c + 1);
    }
  }, []);

  useEffect(() => {
    if (!active) {
      setStatus(null);
      setLoading(false);
      setConsecutiveErrors(0);
      completedRef.current = false;
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    completedRef.current = false;

    fetchStatus(controller.signal).then(() => setLoading(false));

    const timer = setInterval(() => {
      if (completedRef.current) {
        clearInterval(timer);
        return;
      }
      fetchStatus(controller.signal);
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [active, fetchStatus]);

  return { status, loading, consecutiveErrors };
}
