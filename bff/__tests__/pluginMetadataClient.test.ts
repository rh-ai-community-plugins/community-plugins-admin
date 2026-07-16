import https from 'https';
import { EventEmitter } from 'events';
import {
  getPluginMetadata,
  getAllPluginMetadata,
  clearPluginCache,
} from '../src/services/pluginMetadataClient';
import { RegistryPlugin } from '../src/types/catalog';

jest.mock('https');
jest.mock('http');

const mockedHttps = jest.mocked(https);

const SAMPLE_PLUGIN_YAML = `
name: brewet
displayName: Brewet Storage Explorer
description: Object storage browser for RHOAI
version: 1.2.0
maintainer:
  name: Test Maintainer
  github: test-maintainer
rhoai_compatibility:
  min_version: "3.3.0"
  tested_versions: ["3.3.0", "3.4.2"]
deployment_model: cluster-shared
image:
  repository: quay.io/test/brewet
  tag: "1.2.0"
install:
  method: automatic
  helm:
    registry: oci://quay.io/test/brewet-chart
support:
  repo: https://github.com/test/brewet
`;

const REGISTRY_PLUGIN: RegistryPlugin = {
  name: 'brewet',
  repo: 'https://github.com/rh-aiservices-bu/odh-tec',
  status: 'experimental',
  maintenance: 'red-hat',
  last_updated: '2026-06-24',
};

const REGISTRY_PLUGIN_2: RegistryPlugin = {
  name: 'sardeenz',
  repo: 'https://github.com/rh-aiservices-bu/sardeenz',
  status: 'stable',
  maintenance: 'community',
  last_updated: '2026-06-24',
};

function createMockResponse(statusCode: number, body: string) {
  const res = new EventEmitter() as EventEmitter & { statusCode: number };
  res.statusCode = statusCode;
  process.nextTick(() => {
    res.emit('data', Buffer.from(body));
    res.emit('end');
  });
  return res;
}

function mockHttpsGet(statusCode: number, body: string) {
  mockedHttps.get.mockImplementation((_url: any, callback: any) => {
    callback(createMockResponse(statusCode, body));
    const req = new EventEmitter() as any;
    req.end = jest.fn();
    return req;
  });
}

describe('pluginMetadataClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    clearPluginCache();
    process.env = { ...originalEnv };
    delete process.env.PLUGIN_CACHE_TTL_MS;
    delete process.env.PLUGIN_FETCH_CONCURRENCY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getPluginMetadata', () => {
    it('fetches and parses plugin.yaml', async () => {
      mockHttpsGet(200, SAMPLE_PLUGIN_YAML);

      const metadata = await getPluginMetadata(REGISTRY_PLUGIN);

      expect(metadata).not.toBeNull();
      expect(metadata!.name).toBe('brewet');
      expect(metadata!.displayName).toBe('Brewet Storage Explorer');
      expect(metadata!.version).toBe('1.2.0');
      expect(metadata!.deployment_model).toBe('cluster-shared');
    });

    it('returns cached data on subsequent calls', async () => {
      mockHttpsGet(200, SAMPLE_PLUGIN_YAML);

      await getPluginMetadata(REGISTRY_PLUGIN);
      await getPluginMetadata(REGISTRY_PLUGIN);

      expect(mockedHttps.get).toHaveBeenCalledTimes(1);
    });

    it('returns null for 404 responses', async () => {
      mockHttpsGet(404, 'Not Found');

      const metadata = await getPluginMetadata(REGISTRY_PLUGIN);
      expect(metadata).toBeNull();
    });

    it('returns null for invalid YAML', async () => {
      mockHttpsGet(200, 'just a string');

      const metadata = await getPluginMetadata(REGISTRY_PLUGIN);
      expect(metadata).toBeNull();
    });

    it('returns null for YAML missing name field', async () => {
      mockHttpsGet(200, 'description: something\nversion: 1.0.0');

      const metadata = await getPluginMetadata(REGISTRY_PLUGIN);
      expect(metadata).toBeNull();
    });

    it('returns null for network errors', async () => {
      mockedHttps.get.mockImplementation((_url: any, _callback: any) => {
        const req = new EventEmitter() as any;
        req.end = jest.fn();
        process.nextTick(() => req.emit('error', new Error('ECONNREFUSED')));
        return req;
      });

      const metadata = await getPluginMetadata(REGISTRY_PLUGIN);
      expect(metadata).toBeNull();
    });

    it('returns null for invalid repo URL', async () => {
      const badPlugin: RegistryPlugin = {
        ...REGISTRY_PLUGIN,
        repo: 'not-a-github-url',
      };

      const metadata = await getPluginMetadata(badPlugin);
      expect(metadata).toBeNull();
    });

    it('constructs correct raw GitHub URL', async () => {
      mockHttpsGet(200, SAMPLE_PLUGIN_YAML);

      await getPluginMetadata(REGISTRY_PLUGIN);

      expect(mockedHttps.get).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/rh-aiservices-bu/odh-tec/main/plugin.yaml',
        expect.any(Function),
      );
    });
  });

  describe('getAllPluginMetadata', () => {
    it('fetches metadata for all plugins', async () => {
      mockHttpsGet(200, SAMPLE_PLUGIN_YAML);

      const result = await getAllPluginMetadata([REGISTRY_PLUGIN, REGISTRY_PLUGIN_2]);

      expect(result.size).toBe(2);
      expect(result.has('brewet')).toBe(true);
      expect(result.has('sardeenz')).toBe(true);
    });

    it('handles mixed success/failure', async () => {
      let callCount = 0;
      mockedHttps.get.mockImplementation((_url: any, callback: any) => {
        callCount++;
        if (callCount === 1) {
          callback(createMockResponse(200, SAMPLE_PLUGIN_YAML));
        } else {
          callback(createMockResponse(404, 'Not Found'));
        }
        const req = new EventEmitter() as any;
        req.end = jest.fn();
        return req;
      });

      const result = await getAllPluginMetadata([REGISTRY_PLUGIN, REGISTRY_PLUGIN_2]);

      expect(result.get('brewet')).not.toBeNull();
      expect(result.get('sardeenz')).toBeNull();
    });
  });

  describe('clearPluginCache', () => {
    it('clears a specific plugin cache', async () => {
      mockHttpsGet(200, SAMPLE_PLUGIN_YAML);

      await getPluginMetadata(REGISTRY_PLUGIN);
      clearPluginCache('brewet');
      await getPluginMetadata(REGISTRY_PLUGIN);

      expect(mockedHttps.get).toHaveBeenCalledTimes(2);
    });

    it('clears all plugin caches', async () => {
      mockHttpsGet(200, SAMPLE_PLUGIN_YAML);

      await getPluginMetadata(REGISTRY_PLUGIN);
      await getPluginMetadata(REGISTRY_PLUGIN_2);
      clearPluginCache();
      await getPluginMetadata(REGISTRY_PLUGIN);

      expect(mockedHttps.get).toHaveBeenCalledTimes(3);
    });
  });
});
