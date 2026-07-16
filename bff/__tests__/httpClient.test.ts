import https from 'https';
import { EventEmitter } from 'events';
import { fetchUrl } from '../src/utils/httpClient';

jest.mock('https');
jest.mock('http');

const mockedHttps = jest.mocked(https);

function createMockResponse(statusCode: number, body: string | Buffer, headers: Record<string, string> = {}) {
  const res = new EventEmitter() as EventEmitter & {
    statusCode: number;
    headers: Record<string, string>;
    destroy: jest.Mock;
  };
  res.statusCode = statusCode;
  res.headers = headers;
  res.destroy = jest.fn(() => {
    process.nextTick(() => res.emit('error', new Error('destroyed')));
  });
  process.nextTick(() => {
    const buf = typeof body === 'string' ? Buffer.from(body) : body;
    if (buf.length > 0) {
      res.emit('data', buf);
    }
    res.emit('end');
  });
  return res;
}

function mockGet(factory: () => { statusCode: number; body: string | Buffer; headers?: Record<string, string> }) {
  mockedHttps.get.mockImplementation((_url: any, _opts: any, callback: any) => {
    if (typeof _opts === 'function') {
      callback = _opts;
    }
    const { statusCode, body, headers } = factory();
    callback(createMockResponse(statusCode, body, headers));
    const req = new EventEmitter() as any;
    req.end = jest.fn();
    req.destroy = jest.fn();
    return req;
  });
}

describe('fetchUrl', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('fetches content from HTTPS URL', async () => {
    mockGet(() => ({ statusCode: 200, body: 'hello world' }));

    const result = await fetchUrl('https://example.com/file.txt');
    expect(result).toBe('hello world');
  });

  it('rejects on non-2xx status', async () => {
    mockGet(() => ({ statusCode: 404, body: 'Not Found' }));

    await expect(fetchUrl('https://example.com/missing')).rejects.toThrow('HTTP 404');
  });

  it('rejects on network error', async () => {
    mockedHttps.get.mockImplementation((_url: any, _opts: any, _callback: any) => {
      const req = new EventEmitter() as any;
      req.end = jest.fn();
      req.destroy = jest.fn();
      process.nextTick(() => req.emit('error', new Error('ECONNREFUSED')));
      return req;
    });

    await expect(fetchUrl('https://example.com')).rejects.toThrow('ECONNREFUSED');
  });

  it('follows redirects', async () => {
    let callCount = 0;
    mockedHttps.get.mockImplementation((_url: any, _opts: any, callback: any) => {
      if (typeof _opts === 'function') {
        callback = _opts;
      }
      callCount++;
      if (callCount === 1) {
        callback(createMockResponse(301, '', { location: 'https://example.com/redirected' }));
      } else {
        callback(createMockResponse(200, 'redirected content'));
      }
      const req = new EventEmitter() as any;
      req.end = jest.fn();
      req.destroy = jest.fn();
      return req;
    });

    const result = await fetchUrl('https://example.com/original');
    expect(result).toBe('redirected content');
    expect(mockedHttps.get).toHaveBeenCalledTimes(2);
  });

  it('rejects after too many redirects', async () => {
    mockedHttps.get.mockImplementation((_url: any, _opts: any, callback: any) => {
      if (typeof _opts === 'function') {
        callback = _opts;
      }
      callback(createMockResponse(301, '', { location: 'https://example.com/loop' }));
      const req = new EventEmitter() as any;
      req.end = jest.fn();
      req.destroy = jest.fn();
      return req;
    });

    await expect(fetchUrl('https://example.com/start')).rejects.toThrow('Too many redirects');
  });

  it('rejects on timeout', async () => {
    mockedHttps.get.mockImplementation((_url: any, _opts: any, _callback: any) => {
      const req = new EventEmitter() as any;
      req.end = jest.fn();
      req.destroy = jest.fn();
      process.nextTick(() => req.emit('timeout'));
      return req;
    });

    await expect(fetchUrl('https://example.com/slow')).rejects.toThrow('timed out');
  });
});
