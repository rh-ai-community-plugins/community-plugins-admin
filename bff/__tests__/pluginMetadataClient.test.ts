import {
  getPluginMetadata,
  getAllPluginMetadata,
  clearPluginCache,
} from '../src/services/pluginMetadataClient';
import * as httpClient from '../src/utils/httpClient';
import { RegistryPlugin } from '../src/types/catalog';

jest.mock('../src/utils/httpClient');

const mockedFetchUrl = jest.mocked(httpClient.fetchUrl);

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
      mockedFetchUrl.mockResolvedValue(SAMPLE_PLUGIN_YAML);

      const metadata = await getPluginMetadata(REGISTRY_PLUGIN);

      expect(metadata).not.toBeNull();
      expect(metadata!.name).toBe('brewet');
      expect(metadata!.displayName).toBe('Brewet Storage Explorer');
      expect(metadata!.version).toBe('1.2.0');
      expect(metadata!.deployment_model).toBe('cluster-shared');
    });

    it('returns cached data on subsequent calls', async () => {
      mockedFetchUrl.mockResolvedValue(SAMPLE_PLUGIN_YAML);

      await getPluginMetadata(REGISTRY_PLUGIN);
      await getPluginMetadata(REGISTRY_PLUGIN);

      expect(mockedFetchUrl).toHaveBeenCalledTimes(1);
    });

    it('returns null on fetch failure', async () => {
      mockedFetchUrl.mockRejectedValue(new Error('HTTP 404'));

      const metadata = await getPluginMetadata(REGISTRY_PLUGIN);
      expect(metadata).toBeNull();
    });

    it('returns null for invalid YAML', async () => {
      mockedFetchUrl.mockResolvedValue('just a string');

      const metadata = await getPluginMetadata(REGISTRY_PLUGIN);
      expect(metadata).toBeNull();
    });

    it('returns null for YAML missing name field', async () => {
      mockedFetchUrl.mockResolvedValue('description: something\nversion: 1.0.0');

      const metadata = await getPluginMetadata(REGISTRY_PLUGIN);
      expect(metadata).toBeNull();
    });

    it('returns null for network errors', async () => {
      mockedFetchUrl.mockRejectedValue(new Error('ECONNREFUSED'));

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
      mockedFetchUrl.mockResolvedValue(SAMPLE_PLUGIN_YAML);

      await getPluginMetadata(REGISTRY_PLUGIN);

      expect(mockedFetchUrl).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/rh-aiservices-bu/odh-tec/main/plugin.yaml',
      );
    });

    it('uses custom default_branch when specified', async () => {
      mockedFetchUrl.mockResolvedValue(SAMPLE_PLUGIN_YAML);

      const pluginWithMasterBranch: RegistryPlugin = {
        ...REGISTRY_PLUGIN,
        default_branch: 'master',
      };

      await getPluginMetadata(pluginWithMasterBranch);

      expect(mockedFetchUrl).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/rh-aiservices-bu/odh-tec/master/plugin.yaml',
      );
    });

    it('falls back to main when default_branch is not set', async () => {
      mockedFetchUrl.mockResolvedValue(SAMPLE_PLUGIN_YAML);

      const pluginNoBranch: RegistryPlugin = {
        ...REGISTRY_PLUGIN,
      };
      delete pluginNoBranch.default_branch;

      await getPluginMetadata(pluginNoBranch);

      expect(mockedFetchUrl).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/rh-aiservices-bu/odh-tec/main/plugin.yaml',
      );
    });

    it('uses a non-standard branch name correctly', async () => {
      mockedFetchUrl.mockResolvedValue(SAMPLE_PLUGIN_YAML);

      const pluginWithCustomBranch: RegistryPlugin = {
        ...REGISTRY_PLUGIN,
        default_branch: 'develop',
      };

      await getPluginMetadata(pluginWithCustomBranch);

      expect(mockedFetchUrl).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/rh-aiservices-bu/odh-tec/develop/plugin.yaml',
      );
    });
  });

  describe('getAllPluginMetadata', () => {
    it('fetches metadata for all plugins', async () => {
      mockedFetchUrl.mockResolvedValue(SAMPLE_PLUGIN_YAML);

      const result = await getAllPluginMetadata([REGISTRY_PLUGIN, REGISTRY_PLUGIN_2]);

      expect(result.size).toBe(2);
      expect(result.has('brewet')).toBe(true);
      expect(result.has('sardeenz')).toBe(true);
    });

    it('handles mixed success/failure', async () => {
      let callCount = 0;
      mockedFetchUrl.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return SAMPLE_PLUGIN_YAML;
        throw new Error('HTTP 404');
      });

      const result = await getAllPluginMetadata([REGISTRY_PLUGIN, REGISTRY_PLUGIN_2]);

      expect(result.get('brewet')).not.toBeNull();
      expect(result.get('sardeenz')).toBeNull();
    });
  });

  describe('clearPluginCache', () => {
    it('clears a specific plugin cache', async () => {
      mockedFetchUrl.mockResolvedValue(SAMPLE_PLUGIN_YAML);

      await getPluginMetadata(REGISTRY_PLUGIN);
      clearPluginCache('brewet');
      await getPluginMetadata(REGISTRY_PLUGIN);

      expect(mockedFetchUrl).toHaveBeenCalledTimes(2);
    });

    it('clears all plugin caches', async () => {
      mockedFetchUrl.mockResolvedValue(SAMPLE_PLUGIN_YAML);

      await getPluginMetadata(REGISTRY_PLUGIN);
      await getPluginMetadata(REGISTRY_PLUGIN_2);
      clearPluginCache();
      await getPluginMetadata(REGISTRY_PLUGIN);

      expect(mockedFetchUrl).toHaveBeenCalledTimes(3);
    });
  });
});
