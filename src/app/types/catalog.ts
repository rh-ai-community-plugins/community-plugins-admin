export interface PluginMaintainer {
  name: string;
  github: string;
}

export interface PluginImage {
  repository: string;
  tag: string;
}

export interface CatalogPluginInstall {
  method: 'automatic' | 'assisted' | 'manual';
  namespace?: string;
  helm?: {
    chartPath?: string;
    registry?: string;
  };
  prerequisites?: string[];
  instructions?: string;
}

export interface CatalogPluginRbacRule {
  description?: string;
  apiGroups?: string[];
  resources?: string[];
  verbs?: string[];
}

export interface CatalogPluginRbac {
  // Canonically a list of human-readable strings, but some plugin manifests
  // declare full policy-rule objects, so we accept both shapes.
  requiredRoles?: Array<string | CatalogPluginRbacRule>;
  clusterRoles?: boolean;
}

export interface CatalogPluginRemotePath {
  type: string;
  path: string;
  extensions?: string[];
}

export interface CatalogPluginRemoteSpec {
  name?: string;
  scope?: string;
  remoteEntry?: string;
  paths?: CatalogPluginRemotePath[];
}

export interface CatalogPluginRemote {
  type: string;
  spec?: CatalogPluginRemoteSpec;
}

export interface PluginSupport {
  repo?: string;
  docs?: string;
  issues?: string;
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
  remote?: CatalogPluginRemote;
  support?: PluginSupport;
}

export interface CatalogResponse {
  plugins: CatalogPlugin[];
  warnings?: string[];
}
