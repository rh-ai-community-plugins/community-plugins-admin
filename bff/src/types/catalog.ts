export interface RegistryPlugin {
  name: string;
  repo: string;
  status: 'experimental' | 'stable';
  maintenance: 'red-hat' | 'community';
  last_updated: string;
}

export interface RegistryFile {
  plugins: RegistryPlugin[];
}

export interface PluginMaintainer {
  name: string;
  github: string;
}

export interface PluginImage {
  repository: string;
  tag: string;
}

export interface PluginInstall {
  method: 'automatic' | 'assisted' | 'manual';
  helm?: {
    chart_path?: string;
    registry?: string;
  };
  prerequisites?: string[];
  instructions?: string;
}

export interface PluginSupport {
  repo?: string;
  docs?: string;
  issues?: string;
}

export interface PluginRbac {
  required_roles?: string[];
  cluster_roles?: boolean;
}

export interface PluginMetadata {
  name: string;
  displayName?: string;
  description?: string;
  version?: string;
  maintainer?: PluginMaintainer;
  rhoai_compatibility?: {
    min_version?: string;
    tested_versions?: string[];
  };
  deployment_model?: 'cluster-shared' | 'per-project' | 'both';
  image?: PluginImage;
  bff_image?: PluginImage;
  install?: PluginInstall;
  rbac?: PluginRbac;
  support?: PluginSupport;
}

export interface CatalogPluginInstall {
  method: 'automatic' | 'assisted' | 'manual';
  helm?: {
    chartPath?: string;
    registry?: string;
  };
  prerequisites?: string[];
  instructions?: string;
}

export interface CatalogPluginRbac {
  requiredRoles?: string[];
  clusterRoles?: boolean;
}

export interface CatalogPlugin {
  name: string;
  repo: string;
  status: 'experimental' | 'stable';
  maintenance: 'red-hat' | 'community';
  lastUpdated: string;
  metadataAvailable: boolean;
  displayName?: string;
  description?: string;
  version?: string;
  maintainer?: PluginMaintainer;
  rhoaiCompatibility?: {
    minVersion?: string;
    testedVersions?: string[];
  };
  deploymentModel?: 'cluster-shared' | 'per-project' | 'both';
  image?: PluginImage;
  bffImage?: PluginImage;
  install?: CatalogPluginInstall;
  rbac?: CatalogPluginRbac;
  support?: PluginSupport;
}
