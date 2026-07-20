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

export type LifecycleProgressCallback = (steps: LifecycleStep[]) => void;

export interface MFServiceRef {
  name: string;
  namespace: string;
  port: number;
}

export interface MFBackend {
  remoteEntry: string;
  authorize?: boolean;
  tls?: boolean;
  service: MFServiceRef;
}

export interface MFProxyService {
  path: string;
  pathRewrite: string;
  authorize?: boolean;
  tls?: boolean;
  service: MFServiceRef;
}

export interface ModuleFederationEntry {
  name: string;
  backend?: MFBackend;
  proxyService?: MFProxyService[];
  [key: string]: unknown;
}
