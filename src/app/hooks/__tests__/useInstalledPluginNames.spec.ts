import { renderHook, waitFor } from '@testing-library/react';
import { useInstalledPluginNames, scopeToKebab } from '../useInstalledPluginNames';

const mockConfig = {
  bffNamespace: 'cp-plugins-admin',
  dashboardNamespace: 'redhat-ods-applications',
  dashboardDeployment: 'rhods-dashboard',
};

// Names are camelCase in MODULE_FEDERATION_CONFIG (e.g. communityPluginsAdmin),
// matching the Module Federation container name in plugin.yaml.
const mockDeployment = {
  spec: {
    template: {
      spec: {
        containers: [
          {
            name: 'rhods-dashboard',
            env: [
              { name: 'OTHER_VAR', value: 'foo' },
              {
                name: 'MODULE_FEDERATION_CONFIG',
                value: JSON.stringify([
                  {
                    name: 'communityPluginsAdmin',
                    backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'community-plugins-admin', namespace: 'community-plugins-admin', port: 8080 } },
                  },
                  {
                    name: 'brewet',
                    backend: { remoteEntry: '/remoteEntry.js', tls: false, service: { name: 'brewet', namespace: 'brewet', port: 8080 } },
                  },
                ]),
              },
            ],
          },
        ],
      },
    },
  },
};

describe('scopeToKebab', () => {
  it('converts camelCase scope to kebab-case', () => {
    expect(scopeToKebab('communityPluginsAdmin')).toBe('community-plugins-admin');
    expect(scopeToKebab('myPlugin')).toBe('my-plugin');
    expect(scopeToKebab('fooBarBaz')).toBe('foo-bar-baz');
  });

  it('leaves already-lowercase scopes unchanged', () => {
    expect(scopeToKebab('brewet')).toBe('brewet');
    expect(scopeToKebab('myplugin')).toBe('myplugin');
  });
});

describe('useInstalledPluginNames', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return installed plugin names from MODULE_FEDERATION_CONFIG, normalized to kebab-case', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockConfig) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockDeployment) });

    const { result } = renderHook(() => useInstalledPluginNames());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    // camelCase name "communityPluginsAdmin" → kebab "community-plugins-admin"
    // all-lowercase name "brewet" stays "brewet"
    expect(result.current.installedNames).toEqual(
      new Set(['community-plugins-admin', 'brewet']),
    );
    expect(result.current.error).toBeNull();
  });

  it('should return empty set when MODULE_FEDERATION_CONFIG is missing', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockConfig) })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            spec: {
              template: {
                spec: {
                  containers: [{ name: 'rhods-dashboard', env: [] }],
                },
              },
            },
          }),
      });

    const { result } = renderHook(() => useInstalledPluginNames());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.installedNames).toEqual(new Set());
    expect(result.current.error).toBeNull();
  });

  it('should return empty set and set error on invalid JSON in MODULE_FEDERATION_CONFIG', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockConfig) })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            spec: {
              template: {
                spec: {
                  containers: [
                    {
                      name: 'rhods-dashboard',
                      env: [
                        {
                          name: 'MODULE_FEDERATION_CONFIG',
                          value: 'not-valid-json',
                        },
                      ],
                    },
                  ],
                },
              },
            },
          }),
      });

    const { result } = renderHook(() => useInstalledPluginNames());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.installedNames).toEqual(new Set());
    expect(result.current.error).toBeTruthy();
  });

  it('should return empty set and set error when MODULE_FEDERATION_CONFIG is valid JSON but not an array', async () => {
    const nonArrayValues = [
      JSON.stringify({}),
      JSON.stringify(null),
      JSON.stringify('string'),
      JSON.stringify(42),
    ];

    for (const value of nonArrayValues) {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockConfig) })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              spec: {
                template: {
                  spec: {
                    containers: [
                      {
                        name: 'rhods-dashboard',
                        env: [{ name: 'MODULE_FEDERATION_CONFIG', value }],
                      },
                    ],
                  },
                },
              },
            }),
        });

      const { result } = renderHook(() => useInstalledPluginNames());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.installedNames).toEqual(new Set());
      expect(result.current.error).toMatch(/MODULE_FEDERATION_CONFIG is not an array/);
    }
  });

  it('should return empty set and error on config fetch failure', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    const { result } = renderHook(() => useInstalledPluginNames());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.installedNames).toEqual(new Set());
    expect(result.current.error).toBe('Failed to fetch BFF config: 403');
  });

  it('should return empty set and error on deployment fetch failure', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockConfig) })
      .mockResolvedValueOnce({ ok: false, status: 403 });

    const { result } = renderHook(() => useInstalledPluginNames());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.installedNames).toEqual(new Set());
    expect(result.current.error).toBe(
      'Failed to fetch dashboard deployment: 403',
    );
  });

  it('should return empty set and error on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useInstalledPluginNames());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.installedNames).toEqual(new Set());
    expect(result.current.error).toBe('Network error');
  });
});
