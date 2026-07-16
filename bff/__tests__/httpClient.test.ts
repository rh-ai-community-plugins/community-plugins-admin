import https from 'https';
import { EventEmitter } from 'events';
import { fetchUrl } from '../src/utils/httpClient';

jest.mock('https');
jest.mock('http');

const mockedHttps = jest.mocked(https);

function createMockResponse(statusCode: number, body: string, headers: Record<string, string> = {}) {
  const res = new EventEmitter() as EventEmitter & { statusCode: number; headers: Record<string, string> };
  res.statusCode = statusCode;
  res.headers = headers;
  process.nextTick(() => {
    res.emit('data', Buffer.from(body));
    res.emit('end');
  });
  return res;
}

describe('fetchUrl', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('fetches content from HTTPS URL', async () => {
    mockedHttps.get.mockImplementation((_url: any, callback: any) => {
      callback(createMockResponse(200, 'hello world'));
      const req = new EventEmitter() as any;
      req.end = jest.fn();
      return req;
    });

    const result = await fetchUrl('https://example.com/file.txt');
    expect(result).toBe('hello world');
  });

  it('rejects on non-2xx status', async () => {
    mockedHttps.get.mockImplementation((_url: any, callback: any) => {
      callback(createMockResponse(404, 'Not Found'));
      const req = new EventEmitter() as any;
      req.end = jest.fn();
      return req;
    });

    await expect(fetchUrl('https://example.com/missing')).rejects.toThrow('HTTP 404');
  });

  it('rejects on network error', async () => {
    mockedHttps.get.mockImplementation((_url: any, _callback: any) => {
      const req = new EventEmitter() as any;
      req.end = jest.fn();
      process.nextTick(() => req.emit('error', new Error('ECONNREFUSED')));
      return req;
    });

    await expect(fetchUrl('https://example.com')).rejects.toThrow('ECONNREFUSED');
  });

  it('follows redirects', async () => {
    let callCount = 0;
    mockedHttps.get.mockImplementation((_url: any, callback: any) => {
      callCount++;
      if (callCount === 1) {
        callback(createMockResponse(301, '', { location: 'https://example.com/redirected' }));
      } else {
        callback(createMockResponse(200, 'redirected content'));
      }
      const req = new EventEmitter() as any;
      req.end = jest.fn();
      return req;
    });

    const result = await fetchUrl('https://example.com/original');
    expect(result).toBe('redirected content');
    expect(mockedHttps.get).toHaveBeenCalledTimes(2);
  });
});
