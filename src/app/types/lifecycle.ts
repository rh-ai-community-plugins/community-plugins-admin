export interface LifecycleStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

export interface LifecycleResponse {
  success: boolean;
  message: string;
  steps: LifecycleStep[];
}

export type LifecycleOperation = 'install' | 'upgrade' | 'remove' | 'enable' | 'disable';
