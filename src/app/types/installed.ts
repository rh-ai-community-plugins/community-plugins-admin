import { CatalogPlugin } from '~/app/types/catalog';

export interface ModuleFederationEntry {
  scope: string;
  module: string;
  remoteEntry: string;
}

export type PluginHealthStatus = 'running' | 'degraded' | 'stopped' | 'unknown';

export interface InstalledPlugin {
  name: string;
  scope: string;
  module: string;
  remoteEntry: string;
  enabled: boolean;
  healthStatus: PluginHealthStatus;
  availableReplicas?: number;
  desiredReplicas?: number;
  catalogPlugin?: CatalogPlugin;
}
