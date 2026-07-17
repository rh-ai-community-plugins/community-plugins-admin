import {
  scopeToKebab,
  kebabToCamelScope,
  getModuleFederationConfig,
  addPluginToConfig,
  removePluginFromConfig,
} from '../src/services/dashboardConfigService';
import { k8sRequest } from '../src/services/k8sApiClient';

jest.mock('../src/services/k8sApiClient');

const mockK8sRequest = k8sRequest as jest.MockedFunction<typeof k8sRequest>;

const deploymentWithConfig = (configValue: string) => ({
  spec: {
    template: {
      spec: {
        containers: [
          {
            name: 'rhods-dashboard',
            env: [
              { name: 'OTHER_VAR', value: 'foo' },
              { name: 'MODULE_FEDERATION_CONFIG', value: configValue },
            ],
          },
        ],
      },
    },
  },
});

const sampleEntries = [
  { scope: 'communityPluginsAdmin', module: './extensions', remoteEntry: 'http://svc:8080/remoteEntry.js' },
];

describe('scopeToKebab', () => {
  it('converts camelCase to kebab-case', () => {
    expect(scopeToKebab('communityPluginsAdmin')).toBe('community-plugins-admin');
    expect(scopeToKebab('myPlugin')).toBe('my-plugin');
  });

  it('leaves lowercase unchanged', () => {
    expect(scopeToKebab('brewet')).toBe('brewet');
  });
});

describe('kebabToCamelScope', () => {
  it('converts kebab-case to camelCase', () => {
    expect(kebabToCamelScope('community-plugins-admin')).toBe('communityPluginsAdmin');
    expect(kebabToCamelScope('my-plugin')).toBe('myPlugin');
  });

  it('leaves non-hyphenated strings unchanged', () => {
    expect(kebabToCamelScope('brewet')).toBe('brewet');
  });
});

describe('getModuleFederationConfig', () => {
  it('returns entries from deployment', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    const result = await getModuleFederationConfig('test-token');
    expect(result).toEqual(sampleEntries);
  });

  it('returns empty array when env var is missing', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: {
        spec: { template: { spec: { containers: [{ name: 'rhods-dashboard', env: [] }] } } },
      },
    });

    const result = await getModuleFederationConfig('test-token');
    expect(result).toEqual([]);
  });

  it('throws on non-200 response', async () => {
    mockK8sRequest.mockResolvedValue({ status: 403, body: {} });
    await expect(getModuleFederationConfig('test-token')).rejects.toThrow('HTTP 403');
  });
});

describe('addPluginToConfig', () => {
  it('adds entry and patches deployment', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    const newEntry = { scope: 'brewet', module: './extensions', remoteEntry: 'http://brewet:8080/remoteEntry.js' };
    await addPluginToConfig('test-token', newEntry);

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(patchCall![0].contentType).toBe('application/json-patch+json');
  });

  it('throws when plugin already exists', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    const duplicate = { scope: 'communityPluginsAdmin', module: './extensions', remoteEntry: 'http://svc:8080/remoteEntry.js' };
    await expect(addPluginToConfig('test-token', duplicate)).rejects.toThrow('already in');
  });
});

describe('removePluginFromConfig', () => {
  it('removes entry and patches deployment', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    await removePluginFromConfig('test-token', 'community-plugins-admin');

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
  });

  it('throws when plugin not found', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    await expect(removePluginFromConfig('test-token', 'nonexistent')).rejects.toThrow('not found');
  });
});
