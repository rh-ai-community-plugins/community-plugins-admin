import { getRegistryPlugins, clearCharterCache } from '../src/services/charterClient';
import * as httpClient from '../src/utils/httpClient';

jest.mock('../src/utils/httpClient');

const mockedFetchUrl = jest.mocked(httpClient.fetchUrl);

const SAMPLE_YAML = `
plugins:
  - name: brewet
    repo: https://github.com/rh-aiservices-bu/odh-tec
    status: experimental
    maintenance: red-hat
    last_updated: 2026-06-24
  - name: sardeenz
    repo: https://github.com/rh-aiservices-bu/sardeenz
    status: stable
    maintenance: community
    last_updated: 2026-06-24
`;

describe('charterClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    clearCharterCache();
    process.env = { ...originalEnv };
    delete process.env.CHARTER_REGISTRY_URL;
    delete process.env.CHARTER_CACHE_TTL_MS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('fetches and parses the registry YAML', async () => {
    mockedFetchUrl.mockResolvedValue(SAMPLE_YAML);

    const plugins = await getRegistryPlugins();

    expect(plugins).toHaveLength(2);
    expect(plugins[0]).toEqual({
      name: 'brewet',
      repo: 'https://github.com/rh-aiservices-bu/odh-tec',
      status: 'experimental',
      maintenance: 'red-hat',
      last_updated: '2026-06-24',
    });
    expect(plugins[1].name).toBe('sardeenz');
  });

  it('returns cached data on subsequent calls', async () => {
    mockedFetchUrl.mockResolvedValue(SAMPLE_YAML);

    const first = await getRegistryPlugins();
    const second = await getRegistryPlugins();

    expect(mockedFetchUrl).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('serves stale cache on fetch failure', async () => {
    mockedFetchUrl.mockResolvedValue(SAMPLE_YAML);
    await getRegistryPlugins();

    process.env.CHARTER_CACHE_TTL_MS = '0';
    mockedFetchUrl.mockRejectedValue(new Error('Network error'));

    const plugins = await getRegistryPlugins();
    expect(plugins).toHaveLength(2);
    expect(plugins[0].name).toBe('brewet');
  });

  it('throws on fetch failure when no cache exists', async () => {
    mockedFetchUrl.mockRejectedValue(new Error('Network error'));

    await expect(getRegistryPlugins()).rejects.toThrow('Network error');
  });

  it('throws on invalid YAML structure', async () => {
    mockedFetchUrl.mockResolvedValue('not_plugins: true');

    await expect(getRegistryPlugins()).rejects.toThrow('Invalid registry format');
  });

  it('uses custom registry URL from env', async () => {
    process.env.CHARTER_REGISTRY_URL = 'https://example.com/plugins.yaml';
    mockedFetchUrl.mockResolvedValue(SAMPLE_YAML);

    await getRegistryPlugins();

    expect(mockedFetchUrl).toHaveBeenCalledWith('https://example.com/plugins.yaml');
  });

  it('clearCharterCache forces a re-fetch', async () => {
    mockedFetchUrl.mockResolvedValue(SAMPLE_YAML);
    await getRegistryPlugins();

    clearCharterCache();
    await getRegistryPlugins();

    expect(mockedFetchUrl).toHaveBeenCalledTimes(2);
  });
});
