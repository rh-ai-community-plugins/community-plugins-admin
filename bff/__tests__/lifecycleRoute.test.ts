import {
  installPlugin,
  upgradePlugin,
  removePlugin,
  enablePlugin,
  disablePlugin,
} from '../src/services/lifecycleService';
import app from '../src/app';
import http from 'http';

jest.mock('../src/services/lifecycleService');

const mockInstall = installPlugin as jest.MockedFunction<typeof installPlugin>;
const mockUpgrade = upgradePlugin as jest.MockedFunction<typeof upgradePlugin>;
const mockRemove = removePlugin as jest.MockedFunction<typeof removePlugin>;
const mockEnable = enablePlugin as jest.MockedFunction<typeof enablePlugin>;
const mockDisable = disablePlugin as jest.MockedFunction<typeof disablePlugin>;

let server: http.Server;
let baseUrl: string;

beforeAll((done) => {
  server = app.listen(0, () => {
    const addr = server.address();
    if (addr && typeof addr === 'object') {
      baseUrl = `http://127.0.0.1:${addr.port}`;
    }
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  jest.resetAllMocks();
});

async function req(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const opts: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const r = http.request(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve({
          status: res.statusCode ?? 0,
          body: raw ? JSON.parse(raw) : {},
        });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

describe('lifecycle routes', () => {
  describe('POST /api/plugins/:name/install', () => {
    it('returns 401 without token', async () => {
      const res = await req('POST', '/api/plugins/my-plugin/install');
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid plugin name', async () => {
      const res = await req('POST', '/api/plugins/INVALID!/install', {}, 'token');
      expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
      mockInstall.mockResolvedValue({ success: true, message: 'ok', steps: [] });
      const res = await req('POST', '/api/plugins/my-plugin/install', {}, 'token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockInstall).toHaveBeenCalledWith('my-plugin', 'token', undefined, undefined);
    });
  });

  describe('POST /api/plugins/:name/upgrade', () => {
    it('returns 401 without token', async () => {
      const res = await req('POST', '/api/plugins/my-plugin/upgrade');
      expect(res.status).toBe(401);
    });

    it('returns 200 on success', async () => {
      mockUpgrade.mockResolvedValue({ success: true, message: 'ok', steps: [] });
      const res = await req('POST', '/api/plugins/my-plugin/upgrade', {}, 'token');
      expect(res.status).toBe(200);
      expect(mockUpgrade).toHaveBeenCalledWith('my-plugin', 'token', undefined);
    });
  });

  describe('DELETE /api/plugins/:name', () => {
    it('returns 401 without token', async () => {
      const res = await req('DELETE', '/api/plugins/my-plugin');
      expect(res.status).toBe(401);
    });

    it('returns 200 on success', async () => {
      mockRemove.mockResolvedValue({ success: true, message: 'ok', steps: [] });
      const res = await req('DELETE', '/api/plugins/my-plugin', undefined, 'token');
      expect(res.status).toBe(200);
      expect(mockRemove).toHaveBeenCalledWith('my-plugin', 'token', false);
    });
  });

  describe('POST /api/plugins/:name/enable', () => {
    it('returns 200 on success', async () => {
      mockEnable.mockResolvedValue({ success: true, message: 'ok', steps: [] });
      const res = await req('POST', '/api/plugins/my-plugin/enable', {}, 'token');
      expect(res.status).toBe(200);
      expect(mockEnable).toHaveBeenCalledWith('my-plugin', 'token');
    });
  });

  describe('POST /api/plugins/:name/disable', () => {
    it('returns 200 on success', async () => {
      mockDisable.mockResolvedValue({ success: true, message: 'ok', steps: [] });
      const res = await req('POST', '/api/plugins/my-plugin/disable', {}, 'token');
      expect(res.status).toBe(200);
      expect(mockDisable).toHaveBeenCalledWith('my-plugin', 'token');
    });
  });
});
