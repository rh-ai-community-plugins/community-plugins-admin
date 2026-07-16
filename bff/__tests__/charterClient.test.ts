import https from 'https';
import { EventEmitter } from 'events';
import { getRegistryPlugins, clearCharterCache } from '../src/services/charterClient';

jest.mock('https');
jest.mock('http');

const mockedHttps = jest.mocked(https);

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
    mockHttpsGet(200, SAMPLE_YAML);

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
    mockHttpsGet(200, SAMPLE_YAML);

    const first = await getRegistryPlugins();
    const second = await getRegistryPlugins();

    expect(mockedHttps.get).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('serves stale cache on fetch failure', async () => {
    mockHttpsGet(200, SAMPLE_YAML);
    await getRegistryPlugins();

    process.env.CHARTER_CACHE_TTL_MS = '0';

    mockedHttps.get.mockImplementation((_url: any, _callback: any) => {
      const req = new EventEmitter() as any;
      req.end = jest.fn();
      process.nextTick(() => req.emit('error', new Error('Network error')));
      return req;
    });

    const plugins = await getRegistryPlugins();
    expect(plugins).toHaveLength(2);
    expect(plugins[0].name).toBe('brewet');
  });

  it('throws on fetch failure when no cache exists', async () => {
    mockedHttps.get.mockImplementation((_url: any, _callback: any) => {
      const req = new EventEmitter() as any;
      req.end = jest.fn();
      process.nextTick(() => req.emit('error', new Error('Network error')));
      return req;
    });

    await expect(getRegistryPlugins()).rejects.toThrow('Network error');
  });

  it('throws on invalid YAML structure', async () => {
    mockHttpsGet(200, 'not_plugins: true');

    await expect(getRegistryPlugins()).rejects.toThrow('Invalid registry format');
  });

  it('throws on non-2xx HTTP status', async () => {
    mockHttpsGet(404, 'Not Found');

    await expect(getRegistryPlugins()).rejects.toThrow('HTTP 404');
  });

  it('uses custom registry URL from env', async () => {
    process.env.CHARTER_REGISTRY_URL = 'https://example.com/plugins.yaml';
    mockHttpsGet(200, SAMPLE_YAML);

    await getRegistryPlugins();

    expect(mockedHttps.get).toHaveBeenCalledWith(
      'https://example.com/plugins.yaml',
      expect.any(Function),
    );
  });

  it('clearCharterCache forces a re-fetch', async () => {
    mockHttpsGet(200, SAMPLE_YAML);
    await getRegistryPlugins();

    clearCharterCache();
    await getRegistryPlugins();

    expect(mockedHttps.get).toHaveBeenCalledTimes(2);
  });
});
