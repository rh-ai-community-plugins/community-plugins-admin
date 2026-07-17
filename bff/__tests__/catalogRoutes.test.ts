import http from 'http';
import { getRegistryPlugins } from '../src/services/charterClient';
import { getAllPluginMetadata, getPluginMetadata, clearPluginCache } from '../src/services/pluginMetadataClient';
import { RegistryPlugin, PluginMetadata } from '../src/types/catalog';

jest.mock('../src/services/charterClient');
jest.mock('../src/services/pluginMetadataClient');

const mockedGetRegistryPlugins = jest.mocked(getRegistryPlugins);
const mockedGetAllPluginMetadata = jest.mocked(getAllPluginMetadata);
const mockedGetPluginMetadata = jest.mocked(getPluginMetadata);
const mockedClearPluginCache = jest.mocked(clearPluginCache);

const REGISTRY_PLUGINS: RegistryPlugin[] = [
  {
    name: 'brewet',
    repo: 'https://github.com/rh-aiservices-bu/odh-tec',
    status: 'experimental',
    maintenance: 'red-hat',
    last_updated: '2026-06-24',
  },
  {
    name: 'sardeenz',
    repo: 'https://github.com/rh-aiservices-bu/sardeenz',
    status: 'stable',
    maintenance: 'community',
    last_updated: '2026-06-24',
  },
];

const BREWET_METADATA: PluginMetadata = {
  name: 'brewet',
  displayName: 'Brewet Storage Explorer',
  description: 'Object storage browser',
  version: '1.2.0',
  deployment_model: 'cluster-shared',
  image: { repository: 'quay.io/test/brewet', tag: '1.2.0' },
  rhoai_compatibility: { min_version: '3.3.0', tested_versions: ['3.3.0'] },
  support: { repo: 'https://github.com/test/brewet' },
};

import app from '../src/app';

let server: http.Server;
let baseUrl: string;

beforeAll((done) => {
  server = app.listen(0, () => {
    const addr = server.address() as { port: number };
    baseUrl = `http://localhost:${addr.port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

async function request(path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode!,
          body: JSON.parse(Buffer.concat(chunks).toString()),
        });
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

describe('GET /api/health', () => {
  it('returns { status: "ok" }', async () => {
    const res = await request('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /api/catalog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns merged catalog with metadata', async () => {
    mockedGetRegistryPlugins.mockResolvedValue(REGISTRY_PLUGINS);
    const metadataMap = new Map<string, PluginMetadata | null>();
    metadataMap.set('brewet', BREWET_METADATA);
    metadataMap.set('sardeenz', null);
    mockedGetAllPluginMetadata.mockResolvedValue(metadataMap);

    const res = await request('/api/catalog');

    expect(res.status).toBe(200);
    expect(res.body.plugins).toHaveLength(2);

    const brewet = res.body.plugins[0];
    expect(brewet.name).toBe('brewet');
    expect(brewet.metadataAvailable).toBe(true);
    expect(brewet.displayName).toBe('Brewet Storage Explorer');
    expect(brewet.version).toBe('1.2.0');
    expect(brewet.rhoaiCompatibility).toEqual({
      minVersion: '3.3.0',
      testedVersions: ['3.3.0'],
    });

    const sardeenz = res.body.plugins[1];
    expect(sardeenz.name).toBe('sardeenz');
    expect(sardeenz.metadataAvailable).toBe(false);
    expect(sardeenz.displayName).toBeUndefined();
  });

  it('passes forceRefresh=true to charterClient and clears plugin cache when refresh=true', async () => {
    mockedGetRegistryPlugins.mockResolvedValue([]);
    mockedGetAllPluginMetadata.mockResolvedValue(new Map());

    await request('/api/catalog?refresh=true');

    expect(mockedGetRegistryPlugins).toHaveBeenCalledWith(true);
    expect(mockedClearPluginCache).toHaveBeenCalled();
  });

  it('passes forceRefresh=false and does not clear plugin cache without refresh param', async () => {
    mockedGetRegistryPlugins.mockResolvedValue([]);
    mockedGetAllPluginMetadata.mockResolvedValue(new Map());

    await request('/api/catalog');

    expect(mockedGetRegistryPlugins).toHaveBeenCalledWith(false);
    expect(mockedClearPluginCache).not.toHaveBeenCalled();
  });

  it('returns 502 on service failure', async () => {
    mockedGetRegistryPlugins.mockRejectedValue(new Error('Network error'));

    const res = await request('/api/catalog');

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Failed to fetch plugin catalog');
  });

  it('includes warnings when all metadata fetches fail', async () => {
    mockedGetRegistryPlugins.mockResolvedValue(REGISTRY_PLUGINS);
    const metadataMap = new Map<string, PluginMetadata | null>();
    metadataMap.set('brewet', null);
    metadataMap.set('sardeenz', null);
    mockedGetAllPluginMetadata.mockResolvedValue(metadataMap);

    const res = await request('/api/catalog');

    expect(res.status).toBe(200);
    expect(res.body.plugins).toHaveLength(2);
    expect(res.body.warnings).toBeDefined();
    expect(res.body.warnings).toHaveLength(1);
    expect(res.body.warnings[0]).toMatch(/Metadata unavailable for 2 of 2 plugins/);
  });

  it('includes warnings when more than 50% of metadata fetches fail', async () => {
    const threePlugins: RegistryPlugin[] = [
      ...REGISTRY_PLUGINS,
      {
        name: 'thirdplugin',
        repo: 'https://github.com/rh-aiservices-bu/thirdplugin',
        status: 'experimental',
        maintenance: 'community',
        last_updated: '2026-06-24',
      },
    ];
    mockedGetRegistryPlugins.mockResolvedValue(threePlugins);
    const metadataMap = new Map<string, PluginMetadata | null>();
    metadataMap.set('brewet', null);
    metadataMap.set('sardeenz', null);
    metadataMap.set('thirdplugin', BREWET_METADATA);
    mockedGetAllPluginMetadata.mockResolvedValue(metadataMap);

    const res = await request('/api/catalog');

    expect(res.status).toBe(200);
    expect(res.body.warnings).toBeDefined();
    expect(res.body.warnings[0]).toMatch(/Metadata unavailable for 2 of 3 plugins/);
  });

  it('does not include warnings when fewer than 50% of metadata fetches fail', async () => {
    mockedGetRegistryPlugins.mockResolvedValue(REGISTRY_PLUGINS);
    const metadataMap = new Map<string, PluginMetadata | null>();
    metadataMap.set('brewet', BREWET_METADATA);
    metadataMap.set('sardeenz', null);
    mockedGetAllPluginMetadata.mockResolvedValue(metadataMap);

    const res = await request('/api/catalog');

    expect(res.status).toBe(200);
    expect(res.body.warnings).toBeUndefined();
  });

  it('does not include warnings when all metadata is available', async () => {
    mockedGetRegistryPlugins.mockResolvedValue(REGISTRY_PLUGINS);
    const metadataMap = new Map<string, PluginMetadata | null>();
    metadataMap.set('brewet', BREWET_METADATA);
    metadataMap.set('sardeenz', BREWET_METADATA);
    mockedGetAllPluginMetadata.mockResolvedValue(metadataMap);

    const res = await request('/api/catalog');

    expect(res.status).toBe(200);
    expect(res.body.warnings).toBeUndefined();
  });

  it('does not include warnings when fewer than 2 plugins exist', async () => {
    const singlePlugin: RegistryPlugin[] = [REGISTRY_PLUGINS[0]];
    mockedGetRegistryPlugins.mockResolvedValue(singlePlugin);
    const metadataMap = new Map<string, PluginMetadata | null>();
    metadataMap.set('brewet', null);
    mockedGetAllPluginMetadata.mockResolvedValue(metadataMap);

    const res = await request('/api/catalog');

    expect(res.status).toBe(200);
    expect(res.body.warnings).toBeUndefined();
  });
});

describe('GET /api/catalog/:name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a single plugin with metadata', async () => {
    mockedGetRegistryPlugins.mockResolvedValue(REGISTRY_PLUGINS);
    mockedGetPluginMetadata.mockResolvedValue(BREWET_METADATA);

    const res = await request('/api/catalog/brewet');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('brewet');
    expect(res.body.metadataAvailable).toBe(true);
    expect(res.body.displayName).toBe('Brewet Storage Explorer');
  });

  it('returns a plugin without metadata', async () => {
    mockedGetRegistryPlugins.mockResolvedValue(REGISTRY_PLUGINS);
    mockedGetPluginMetadata.mockResolvedValue(null);

    const res = await request('/api/catalog/sardeenz');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('sardeenz');
    expect(res.body.metadataAvailable).toBe(false);
  });

  it('returns 404 for unknown plugin', async () => {
    mockedGetRegistryPlugins.mockResolvedValue(REGISTRY_PLUGINS);

    const res = await request('/api/catalog/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('nonexistent');
  });

  it('returns 502 on service failure', async () => {
    mockedGetRegistryPlugins.mockRejectedValue(new Error('Network error'));

    const res = await request('/api/catalog/brewet');

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Failed to fetch plugin details');
  });
});

describe('buildCatalogPlugin field mappings', () => {
  const FULL_REGISTRY_PLUGIN: RegistryPlugin = {
    name: 'full-plugin',
    repo: 'https://github.com/org/full-plugin',
    status: 'stable',
    maintenance: 'red-hat',
    last_updated: '2026-07-01',
  };

  const FULL_METADATA: PluginMetadata = {
    name: 'full-plugin',
    displayName: 'Full Plugin',
    description: 'A fully-featured plugin',
    version: '2.0.0',
    deployment_model: 'per-project',
    image: { repository: 'quay.io/org/full-plugin', tag: '2.0.0' },
    bff_image: { repository: 'quay.io/org/full-plugin-bff', tag: '2.0.0' },
    install: {
      method: 'automatic',
      helm: { chart_path: '/charts/full-plugin', registry: 'oci://quay.io/charts/full-plugin' },
      prerequisites: ['cert-manager'],
      instructions: 'Run helm install',
    },
    rbac: {
      required_roles: ['admin'],
      cluster_roles: true,
    },
    remote: {
      type: 'module-federation',
      spec: {
        name: 'fullPlugin',
        scope: 'fullPlugin',
        remoteEntry: 'http://full-plugin.full-plugin.svc.cluster.local:8080/plugin-entry.js',
        paths: [{ type: 'extension', path: './extensions' }],
      },
    },
    support: {
      repo: 'https://github.com/org/full-plugin',
      docs: 'https://docs.example.com',
      issues: 'https://issues.example.com',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetRegistryPlugins.mockResolvedValue([FULL_REGISTRY_PLUGIN]);
    mockedGetPluginMetadata.mockResolvedValue(FULL_METADATA);
  });

  it('maps install fields with snake_case to camelCase', async () => {
    const res = await request('/api/catalog/full-plugin');
    expect(res.status).toBe(200);
    expect(res.body.install).toEqual({
      method: 'automatic',
      helm: { chartPath: '/charts/full-plugin', registry: 'oci://quay.io/charts/full-plugin' },
      prerequisites: ['cert-manager'],
      instructions: 'Run helm install',
    });
  });

  it('maps rbac fields with snake_case to camelCase', async () => {
    const res = await request('/api/catalog/full-plugin');
    expect(res.status).toBe(200);
    expect(res.body.rbac).toEqual({
      requiredRoles: ['admin'],
      clusterRoles: true,
    });
  });

  it('maps remote fields preserving nested spec structure', async () => {
    const res = await request('/api/catalog/full-plugin');
    expect(res.status).toBe(200);
    expect(res.body.remote).toEqual({
      type: 'module-federation',
      spec: {
        name: 'fullPlugin',
        scope: 'fullPlugin',
        remoteEntry: 'http://full-plugin.full-plugin.svc.cluster.local:8080/plugin-entry.js',
        paths: [{ type: 'extension', path: './extensions' }],
      },
    });
  });

  it('maps deploymentModel from deployment_model', async () => {
    const res = await request('/api/catalog/full-plugin');
    expect(res.status).toBe(200);
    expect(res.body.deploymentModel).toBe('per-project');
  });

  it('maps bffImage from bff_image', async () => {
    const res = await request('/api/catalog/full-plugin');
    expect(res.status).toBe(200);
    expect(res.body.bffImage).toEqual({ repository: 'quay.io/org/full-plugin-bff', tag: '2.0.0' });
  });

  it('passes support fields through without transformation', async () => {
    const res = await request('/api/catalog/full-plugin');
    expect(res.status).toBe(200);
    expect(res.body.support).toEqual({
      repo: 'https://github.com/org/full-plugin',
      docs: 'https://docs.example.com',
      issues: 'https://issues.example.com',
    });
  });
});
