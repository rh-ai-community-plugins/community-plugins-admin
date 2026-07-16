import http from 'http';
import { getRegistryPlugins } from '../src/services/charterClient';
import { getAllPluginMetadata, clearPluginCache } from '../src/services/pluginMetadataClient';
import { RegistryPlugin, PluginMetadata } from '../src/types/catalog';

jest.mock('../src/services/charterClient');
jest.mock('../src/services/pluginMetadataClient');

const mockedGetRegistryPlugins = jest.mocked(getRegistryPlugins);
const mockedGetAllPluginMetadata = jest.mocked(getAllPluginMetadata);
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
});

describe('GET /api/catalog/:name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a single plugin with metadata', async () => {
    mockedGetRegistryPlugins.mockResolvedValue(REGISTRY_PLUGINS);
    const metadataMap = new Map<string, PluginMetadata | null>();
    metadataMap.set('brewet', BREWET_METADATA);
    mockedGetAllPluginMetadata.mockResolvedValue(metadataMap);

    const res = await request('/api/catalog/brewet');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('brewet');
    expect(res.body.metadataAvailable).toBe(true);
    expect(res.body.displayName).toBe('Brewet Storage Explorer');
  });

  it('returns a plugin without metadata', async () => {
    mockedGetRegistryPlugins.mockResolvedValue(REGISTRY_PLUGINS);
    const metadataMap = new Map<string, PluginMetadata | null>();
    metadataMap.set('sardeenz', null);
    mockedGetAllPluginMetadata.mockResolvedValue(metadataMap);

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
