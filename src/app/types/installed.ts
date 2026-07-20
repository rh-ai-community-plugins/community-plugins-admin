import { CatalogPlugin } from '~/app/types/catalog';

export interface ModuleFederationEntry {
  name: string;
  [key: string]: unknown;
}

export type PluginHealthStatus = 'running' | 'degraded' | 'stopped' | 'unknown';

export interface InstalledPlugin {
  name: string;
  mfName: string;
  enabled: boolean;
  healthStatus: PluginHealthStatus;
  availableReplicas?: number;
  desiredReplicas?: number;
  installedVersion?: string;
  catalogPlugin?: CatalogPlugin;
}
