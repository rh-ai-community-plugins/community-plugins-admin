import { renderHook, waitFor } from '@testing-library/react';
import { useInstalledPluginNames } from '../useInstalledPluginNames';

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
                    scope: 'community-plugins-admin',
                    module: './extensions',
                    remoteEntry: 'http://svc:8080/remoteEntry.js',
                  },
                  {
                    scope: 'brewet',
                    module: './extensions',
                    remoteEntry: 'http://brewet:8080/remoteEntry.js',
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

describe('useInstalledPluginNames', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return installed plugin names from MODULE_FEDERATION_CONFIG', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDeployment),
    });

    const { result } = renderHook(() => useInstalledPluginNames());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.installedNames).toEqual(
      new Set(['community-plugins-admin', 'brewet']),
    );
    expect(result.current.error).toBeNull();
  });

  it('should return empty set when MODULE_FEDERATION_CONFIG is missing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
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
    global.fetch = jest.fn().mockResolvedValue({
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
      global.fetch = jest.fn().mockResolvedValue({
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

  it('should return empty set and error on fetch failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
    });

    const { result } = renderHook(() => useInstalledPluginNames());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.installedNames).toEqual(new Set());
    expect(result.current.error).toBe(
      'Failed to fetch dashboard deployment: 403',
    );
  });

  it('should return empty set and error on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useInstalledPluginNames());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.installedNames).toEqual(new Set());
    expect(result.current.error).toBe('Network error');
  });
});
