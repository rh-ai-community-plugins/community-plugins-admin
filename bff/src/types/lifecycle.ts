export interface LifecycleStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

export interface InstallRequest {
  namespace?: string;
  values?: Record<string, unknown>;
}

export interface UpgradeRequest {
  values?: Record<string, unknown>;
}

export interface LifecycleResponse {
  success: boolean;
  message: string;
  steps: LifecycleStep[];
}

export interface ModuleFederationEntry {
  scope: string;
  module: string;
  remoteEntry: string;
}
