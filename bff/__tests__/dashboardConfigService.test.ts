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

const deploymentWithConfigMap = (cmName: string, cmKey: string, resourceVersion?: string) => ({
  ...(resourceVersion !== undefined && { metadata: { resourceVersion } }),
  spec: {
    template: {
      metadata: { annotations: {} },
      spec: {
        containers: [
          {
            name: 'rhods-dashboard',
            env: [
              { name: 'OTHER_VAR', value: 'foo' },
              { name: 'MODULE_FEDERATION_CONFIG', valueFrom: { configMapKeyRef: { name: cmName, key: cmKey } } },
            ],
          },
        ],
      },
    },
  },
});

const deploymentWithInlineAndAnnotation = (configValue: string, cmRef: string, resourceVersion?: string) => ({
  metadata: {
    ...(resourceVersion !== undefined && { resourceVersion }),
    annotations: { 'community-plugins-admin/configMapRef': cmRef },
  },
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
  { name: 'communityPluginsAdmin', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'community-plugins-admin', namespace: 'community-plugins-admin', port: 8080 } } },
];

const oldFormatEntries = [
  { name: 'modelRegistry', remoteEntry: '/remoteEntry.js', authorize: true, tls: true, service: { name: 'rhods-dashboard', namespace: 'redhat-ods-applications', port: 8043 } },
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
  it('returns entries from inline deployment env var', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    const result = await getModuleFederationConfig('test-token');
    expect(result).toEqual(sampleEntries);
  });

  it('returns entries from ConfigMap when env var uses valueFrom', async () => {
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: deploymentWithConfigMap('dashboard-config', 'mf-config'),
    });
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: { data: { 'mf-config': JSON.stringify(oldFormatEntries) } },
    });

    const result = await getModuleFederationConfig('test-token');
    expect(result).toEqual(oldFormatEntries);
  });

  it('resyncs with ConfigMap via saved annotation', async () => {
    const cmEntries = [
      { name: 'modelRegistry', remoteEntry: '/remoteEntry.js' },
      { name: 'newEntry', remoteEntry: '/remoteEntry.js' },
    ];
    const inlineEntries = [
      { name: 'modelRegistry', remoteEntry: '/remoteEntry.js' },
      { name: 'helloWorld', backend: { remoteEntry: '/remoteEntry.js' } },
    ];

    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: deploymentWithInlineAndAnnotation(JSON.stringify(inlineEntries), 'federation-config/mf-config.json'),
    });
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: { data: { 'mf-config.json': JSON.stringify(cmEntries) } },
    });

    const result = await getModuleFederationConfig('test-token');
    // ConfigMap entries (2) + community entries not in ConfigMap (helloWorld)
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.name)).toEqual(['modelRegistry', 'newEntry', 'helloWorld']);
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

  it('adds entry and patches deployment (inline source)', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    const newEntry = { name: 'brewet', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'brewet', namespace: 'brewet', port: 8080 } } };
    await addPluginToConfig('test-token', newEntry);

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(patchCall![0].contentType).toBe('application/json-patch+json');
  });

  it('reads entries from ConfigMap and writes inline with annotation (configmap source)', async () => {
    // GET deployment → valueFrom
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: deploymentWithConfigMap('dashboard-config', 'mf-config', '10'),
    });
    // GET ConfigMap → current entries
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: { data: { 'mf-config': JSON.stringify(oldFormatEntries) } },
    });
    // PATCH deployment → env var + annotation
    mockK8sRequest.mockResolvedValueOnce({ status: 200, body: {} });

    const newEntry = { name: 'brewet', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'brewet', namespace: 'brewet', port: 8080 } } };
    await addPluginToConfig('test-token', newEntry);

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = patchCall![0].body as Array<{ op: string; path: string; value: unknown }>;

    // Env var replace with merged entries
    const replaceOp = patchBody.find((op) => op.op === 'replace');
    expect(replaceOp).toBeDefined();
    const entries = JSON.parse((replaceOp!.value as { value: string }).value);
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe('modelRegistry');
    expect(entries[1].name).toBe('brewet');

    // ConfigMap reference annotation saved
    const annotationOp = patchBody.find((op) => op.path.includes('annotations'));
    expect(annotationOp).toBeDefined();
    expect(annotationOp!.op).toBe('add');
  });

  it('resyncs with ConfigMap via saved annotation on subsequent operations', async () => {
    const cmEntries = [
      { name: 'modelRegistry', remoteEntry: '/remoteEntry.js' },
      { name: 'newOperatorPlugin', remoteEntry: '/remoteEntry.js' },
    ];
    const inlineEntries = [
      { name: 'modelRegistry', remoteEntry: '/remoteEntry.js' },
      { name: 'helloWorld', backend: { remoteEntry: '/remoteEntry.js', service: { name: 'hello-world', namespace: 'hello-world', port: 8080 } } },
    ];

    // GET deployment → inline value + annotation
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: deploymentWithInlineAndAnnotation(JSON.stringify(inlineEntries), 'federation-config/mf-config.json', '20'),
    });
    // GET ConfigMap → updated entries (operator added newOperatorPlugin)
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: { data: { 'mf-config.json': JSON.stringify(cmEntries) } },
    });
    // PATCH deployment
    mockK8sRequest.mockResolvedValueOnce({ status: 200, body: {} });

    const newEntry = { name: 'anotherPlugin', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'another', namespace: 'another', port: 8080 } } };
    await addPluginToConfig('test-token', newEntry);

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    const patchBody = patchCall![0].body as Array<{ op: string; path: string; value: unknown }>;
    const replaceOp = patchBody.find((op) => op.op === 'replace');
    const entries = JSON.parse((replaceOp!.value as { value: string }).value);

    // Should have: 2 from ConfigMap + helloWorld (community) + anotherPlugin (new)
    expect(entries).toHaveLength(4);
    expect(entries.map((e: { name: string }) => e.name)).toEqual([
      'modelRegistry', 'newOperatorPlugin', 'helloWorld', 'anotherPlugin',
    ]);
  });

  it('appends via env/- when container already has an env array', async () => {
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

    const newEntry = { name: 'brewet', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'brewet', namespace: 'brewet', port: 8080 } } };
    await addPluginToConfig('test-token', newEntry);

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = patchCall![0].body as Array<{ op: string; path: string }>;
    expect(patchBody[0].op).toBe('add');
    expect(patchBody[0].path).toMatch(/\/env\/-$/);
  });

  it('creates env array via env (no /-) when container has no env field', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'rhods-dashboard',
                },
              ],
            },
          },
        },
      },
    });

    const newEntry = { name: 'brewet', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'brewet', namespace: 'brewet', port: 8080 } } };
    await addPluginToConfig('test-token', newEntry);

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = patchCall![0].body as Array<{ op: string; path: string; value: unknown }>;
    expect(patchBody[0].op).toBe('add');
    expect(patchBody[0].path).toMatch(/\/env$/);
    expect(Array.isArray(patchBody[0].value)).toBe(true);
  });

  it('throws when plugin already exists', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    const duplicate = { name: 'communityPluginsAdmin', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'cpa', namespace: 'cpa', port: 8080 } } };
    await expect(addPluginToConfig('test-token', duplicate)).rejects.toThrow('already in');
  });

  it('includes resourceVersion test op as the first patch operation', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries), '42'),
    });

    const newEntry = { name: 'brewet', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'brewet', namespace: 'brewet', port: 8080 } } };
    await addPluginToConfig('test-token', newEntry);

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = patchCall![0].body as Array<{ op: string; path: string; value: unknown }>;
    expect(patchBody[0]).toEqual({ op: 'test', path: '/metadata/resourceVersion', value: '42' });
    expect(patchBody[1].op).toBe('replace');
  });

  it('omits the resourceVersion test op when the deployment has no resourceVersion', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    const newEntry = { name: 'brewet', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'brewet', namespace: 'brewet', port: 8080 } } };
    await addPluginToConfig('test-token', newEntry);

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = patchCall![0].body as Array<{ op: string; path: string; value: unknown }>;
    expect(patchBody).toHaveLength(1);
    expect(patchBody[0].op).toBe('replace');
  });

  it('retries on 409 Conflict and succeeds on the second attempt', async () => {
    const newEntry = { name: 'brewet', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'brewet', namespace: 'brewet', port: 8080 } } };

    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries), '1'),
    });
    mockK8sRequest.mockResolvedValueOnce({ status: 409, body: {} });
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries), '2'),
    });
    mockK8sRequest.mockResolvedValueOnce({ status: 200, body: {} });

    await expect(addPluginToConfig('test-token', newEntry)).resolves.toBeUndefined();
    expect(mockK8sRequest).toHaveBeenCalledTimes(4);
  });

  it('throws after exhausting all retries on repeated 409 Conflict', async () => {
    const newEntry = { name: 'brewet', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'brewet', namespace: 'brewet', port: 8080 } } };

    for (let i = 0; i < 3; i++) {
      mockK8sRequest.mockResolvedValueOnce({
        status: 200,
        body: deploymentWithConfig(JSON.stringify(sampleEntries), String(i + 1)),
      });
      mockK8sRequest.mockResolvedValueOnce({ status: 409, body: {} });
    }

    await expect(addPluginToConfig('test-token', newEntry)).rejects.toThrow('409');
    expect(mockK8sRequest).toHaveBeenCalledTimes(6);
  });
});

describe('removePluginFromConfig', () => {
  beforeEach(() => {
    mockK8sRequest.mockReset();
  });

  it('removes entry with camelCase name and patches deployment', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    await removePluginFromConfig('test-token', 'community-plugins-admin');

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
  });

  it('removes entry with PascalCase name by plugin name', async () => {
    const pascalEntries = [
      { name: 'CommunityPluginsAdmin', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'cpa', namespace: 'cpa', port: 8080 } } },
    ];
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(pascalEntries)),
    });

    await removePluginFromConfig('test-token', 'community-plugins-admin');

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = patchCall![0].body as Array<{ value: { name: string; value: string } }>;
    expect(JSON.parse(patchBody[0].value.value)).toEqual([]);
  });

  it('removes only the matching entry when multiple plugins are present', async () => {
    const multiEntries = [
      { name: 'CommunityPluginsAdmin', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'cpa', namespace: 'cpa', port: 8080 } } },
      { name: 'anotherPlugin', backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'ap', namespace: 'ap', port: 8080 } } },
    ];
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(multiEntries)),
    });

    await removePluginFromConfig('test-token', 'community-plugins-admin');

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    expect(patchCall).toBeDefined();
    const patchBody = patchCall![0].body as Array<{ value: { name: string; value: string } }>;
    const remaining = JSON.parse(patchBody[0].value.value);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('anotherPlugin');
  });

  it('resyncs with ConfigMap on remove via annotation', async () => {
    const cmEntries = [
      { name: 'modelRegistry', remoteEntry: '/remoteEntry.js' },
      { name: 'newOperatorEntry', remoteEntry: '/remoteEntry.js' },
    ];
    const inlineEntries = [
      { name: 'modelRegistry', remoteEntry: '/remoteEntry.js' },
      { name: 'helloWorld', backend: { remoteEntry: '/remoteEntry.js', service: { name: 'hello-world', namespace: 'hello-world', port: 8080 } } },
    ];

    // GET deployment → inline + annotation
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: deploymentWithInlineAndAnnotation(JSON.stringify(inlineEntries), 'federation-config/mf-config.json', '20'),
    });
    // GET ConfigMap → operator added newOperatorEntry
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: { data: { 'mf-config.json': JSON.stringify(cmEntries) } },
    });
    // PATCH deployment
    mockK8sRequest.mockResolvedValueOnce({ status: 200, body: {} });

    const result = await removePluginFromConfig('test-token', 'hello-world');
    expect(result).toBe(true);

    const patchCall = mockK8sRequest.mock.calls.find((c) => c[0].method === 'PATCH');
    const patchBody = patchCall![0].body as Array<{ op: string; path: string; value: unknown }>;
    const replaceOp = patchBody.find((op) => op.op === 'replace');
    const remaining = JSON.parse((replaceOp!.value as { value: string }).value);

    // Should have: 2 from ConfigMap (including operator-added entry), helloWorld removed
    expect(remaining).toHaveLength(2);
    expect(remaining.map((e: { name: string }) => e.name)).toEqual(['modelRegistry', 'newOperatorEntry']);
  });

  it('throws when plugin not found', async () => {
    mockK8sRequest.mockResolvedValue({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries)),
    });

    await expect(removePluginFromConfig('test-token', 'nonexistent')).rejects.toThrow('not found');
  });

  it('retries on 409 Conflict and succeeds on the second attempt', async () => {
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries), '1'),
    });
    mockK8sRequest.mockResolvedValueOnce({ status: 409, body: {} });
    mockK8sRequest.mockResolvedValueOnce({
      status: 200,
      body: deploymentWithConfig(JSON.stringify(sampleEntries), '2'),
    });
    mockK8sRequest.mockResolvedValueOnce({ status: 200, body: {} });

    await expect(removePluginFromConfig('test-token', 'community-plugins-admin')).resolves.toBe(true);
    expect(mockK8sRequest).toHaveBeenCalledTimes(4);
  });

  it('throws after exhausting all retries on repeated 409 Conflict', async () => {
    for (let i = 0; i < 3; i++) {
      mockK8sRequest.mockResolvedValueOnce({
        status: 200,
        body: deploymentWithConfig(JSON.stringify(sampleEntries), String(i + 1)),
      });
      mockK8sRequest.mockResolvedValueOnce({ status: 409, body: {} });
    }

    await expect(removePluginFromConfig('test-token', 'community-plugins-admin')).rejects.toThrow('409');
    expect(mockK8sRequest).toHaveBeenCalledTimes(6);
  });
});
