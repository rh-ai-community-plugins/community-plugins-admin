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

const deploymentWithConfig = (configValue: string, resourceVersion?: string) => ({
  ...(resourceVersion !== undefined && { metadata: { resourceVersion } }),
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

  it('handles PascalCase without leading hyphen', () => {
    expect(scopeToKebab('CommunityPlugins')).toBe('community-plugins');
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
  beforeEach(() => {
    mockK8sRequest.mockReset();
  });

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

  it('appends via env/- when container already has an env array', async () => {
    // Container has an existing env array — patch must use env/- to append.
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'rhods-dashboard',
                  env: [{ name: 'OTHER_VAR', value: 'foo' }],
                },
              ],
            },
          },
        },
      },
    });

    const newEntry = { scope: 'brewet', module: './extensions', remoteEntry: 'http://brewet:8080/remoteEntry.js' };
    await addPluginToConfig('test-token', newEntry);

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = patchCall![0].body as Array<{ op: string; path: string }>;
    expect(patchBody[0].op).toBe('add');
    expect(patchBody[0].path).toMatch(/\/env\/-$/);
  });

  it('creates env array via env (no /-) when container has no env field', async () => {
    // Container has NO env field — using env/- would yield HTTP 422.
    // The patch must use env (without /-) to create the array.
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'rhods-dashboard',
                  // intentionally no env field
                },
              ],
            },
          },
        },
      },
    });

    const newEntry = { scope: 'brewet', module: './extensions', remoteEntry: 'http://brewet:8080/remoteEntry.js' };
    await addPluginToConfig('test-token', newEntry);

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = patchCall![0].body as Array<{ op: string; path: string; value: unknown }>;
    expect(patchBody[0].op).toBe('add');
    // Path must end with /env, not /env/-
    expect(patchBody[0].path).toMatch(/\/env$/);
    // Value must be an array containing the new entry
    expect(Array.isArray(patchBody[0].value)).toBe(true);
  });

  it('throws when plugin already exists', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    const duplicate = { scope: 'communityPluginsAdmin', module: './extensions', remoteEntry: 'http://svc:8080/remoteEntry.js' };
    await expect(addPluginToConfig('test-token', duplicate)).rejects.toThrow('already in');
  });

  it('includes resourceVersion test op as the first patch operation', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries), '42'),
    });

    const newEntry = { scope: 'brewet', module: './extensions', remoteEntry: 'http://brewet:8080/remoteEntry.js' };
    await addPluginToConfig('test-token', newEntry);

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = patchCall![0].body as Array<{ op: string; path: string; value: unknown }>;
    // First op must be the resourceVersion test for optimistic concurrency
    expect(patchBody[0]).toEqual({ op: 'test', path: '/metadata/resourceVersion', value: '42' });
    // Second op is the actual mutation
    expect(patchBody[1].op).toBe('replace');
  });

  it('omits the resourceVersion test op when the deployment has no resourceVersion', async () => {
    // Deployment with no metadata.resourceVersion — no test op should be added
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    const newEntry = { scope: 'brewet', module: './extensions', remoteEntry: 'http://brewet:8080/remoteEntry.js' };
    await addPluginToConfig('test-token', newEntry);

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = patchCall![0].body as Array<{ op: string; path: string; value: unknown }>;
    // Only the mutation op should be present (no test op)
    expect(patchBody).toHaveLength(1);
    expect(patchBody[0].op).toBe('replace');
  });

  it('retries on 409 Conflict and succeeds on the second attempt', async () => {
    const newEntry = { scope: 'brewet', module: './extensions', remoteEntry: 'http://brewet:8080/remoteEntry.js' };

    // Attempt 1: GET succeeds with resourceVersion '1', PATCH returns 409
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries), '1'),
    });
    mockK8sRequest.mockResolvedValueOnce({ status: 409, body: {} });
    // Attempt 2: GET succeeds with updated resourceVersion '2', PATCH returns 200
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries), '2'),
    });
    mockK8sRequest.mockResolvedValueOnce({ status: 200, body: {} });

    await expect(addPluginToConfig('test-token', newEntry)).resolves.toBeUndefined();
    // Two GET + two PATCH calls across the two attempts
    expect(mockK8sRequest).toHaveBeenCalledTimes(4);
  });

  it('throws after exhausting all retries on repeated 409 Conflict', async () => {
    const newEntry = { scope: 'brewet', module: './extensions', remoteEntry: 'http://brewet:8080/remoteEntry.js' };

    // Each of the 3 attempts: GET → 200, PATCH → 409
    for (let i = 0; i < 3; i++) {
      mockK8sRequest.mockResolvedValueOnce({
        status: 200,
        body: deploymentWithConfig(JSON.stringify(sampleEntries), String(i + 1)),
      });
      mockK8sRequest.mockResolvedValueOnce({ status: 409, body: {} });
    }

    await expect(addPluginToConfig('test-token', newEntry)).rejects.toThrow('409');
    // 3 attempts × (1 GET + 1 PATCH) = 6 calls total
    expect(mockK8sRequest).toHaveBeenCalledTimes(6);
  });
});

describe('removePluginFromConfig', () => {
  beforeEach(() => {
    mockK8sRequest.mockReset();
  });

  it('removes entry with camelCase scope and patches deployment', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    await removePluginFromConfig('test-token', 'community-plugins-admin');

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
  });

  it('removes entry with PascalCase scope by plugin name', async () => {
    // Simulates the bug scenario: plugin.yaml declares scope "CommunityPluginsAdmin"
    // (PascalCase), which is stored verbatim by addPluginToConfig. removePluginFromConfig
    // must look up the actual stored scope rather than re-deriving it via
    // kebabToCamelScope, which would produce "communityPluginsAdmin" (lowerCamelCase)
    // and fail to match.
    const pascalEntries = [
      {
        scope: 'CommunityPluginsAdmin',
        module: './extensions',
        remoteEntry: 'http://svc:8080/remoteEntry.js',
      },
    ];
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(pascalEntries)),
    });

    await removePluginFromConfig('test-token', 'community-plugins-admin');

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    // Verify the patched value is an empty array (entry was removed)
    const patchBody = patchCall![0].body as Array<{ value: string }>;
    expect(JSON.parse(patchBody[0].value)).toEqual([]);
  });

  it('removes only the matching entry when multiple plugins are present', async () => {
    const multiEntries = [
      { scope: 'CommunityPluginsAdmin', module: './extensions', remoteEntry: 'http://cpa:8080/remoteEntry.js' },
      { scope: 'anotherPlugin', module: './extensions', remoteEntry: 'http://another:8080/remoteEntry.js' },
    ];
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(multiEntries)),
    });

    await removePluginFromConfig('test-token', 'community-plugins-admin');

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = patchCall![0].body as Array<{ value: string }>;
    const remaining = JSON.parse(patchBody[0].value) as typeof multiEntries;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].scope).toBe('anotherPlugin');
  });

  it('throws when plugin not found', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    await expect(removePluginFromConfig('test-token', 'nonexistent')).rejects.toThrow('not found');
  });

  it('retries on 409 Conflict and succeeds on the second attempt', async () => {
    // Attempt 1: GET succeeds with resourceVersion '1', PATCH returns 409
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries), '1'),
    });
    mockK8sRequest.mockResolvedValueOnce({ status: 409, body: {} });
    // Attempt 2: GET succeeds with updated resourceVersion '2', PATCH returns 200
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries), '2'),
    });
    mockK8sRequest.mockResolvedValueOnce({ status: 200, body: {} });

    await expect(removePluginFromConfig('test-token', 'community-plugins-admin')).resolves.toBeUndefined();
    // Two GET + two PATCH calls across the two attempts
    expect(mockK8sRequest).toHaveBeenCalledTimes(4);
  });

  it('throws after exhausting all retries on repeated 409 Conflict', async () => {
    // Each of the 3 attempts: GET → 200, PATCH → 409
    for (let i = 0; i < 3; i++) {
      mockK8sRequest.mockResolvedValueOnce({
        status: 200,
        body: deploymentWithConfig(JSON.stringify(sampleEntries), String(i + 1)),
      });
      mockK8sRequest.mockResolvedValueOnce({ status: 409, body: {} });
    }

    await expect(removePluginFromConfig('test-token', 'community-plugins-admin')).rejects.toThrow('409');
    // 3 attempts × (1 GET + 1 PATCH) = 6 calls total
    expect(mockK8sRequest).toHaveBeenCalledTimes(6);
  });
});
