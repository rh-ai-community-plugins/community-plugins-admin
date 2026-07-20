import https from 'https';
import http from 'http';
import fs from 'fs';
import { getK8sBaseUrl } from '../utils/k8sClient';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 10 * 1024 * 1024;

// undefined = not yet checked, null = confirmed missing, Buffer = cached cert
let cachedCaCert: Buffer | null | undefined;

export function getCaCert(): Buffer | undefined {
  if (cachedCaCert !== undefined) return cachedCaCert === null ? undefined : cachedCaCert;
  const caPath = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
  try {
    cachedCaCert = fs.readFileSync(caPath);
  } catch {
    cachedCaCert = null;
  }
  return cachedCaCert === null ? undefined : cachedCaCert;
}

export interface K8sRequestOptions {
  method: 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE';
  path: string;
  token: string;
  body?: unknown;
  contentType?: string;
}

export interface K8sResponse<T = unknown> {
  status: number;
  body: T;
}

export function k8sRequest<T = unknown>(opts: K8sRequestOptions): Promise<K8sResponse<T>> {
  return new Promise((resolve, reject) => {
    const baseUrl = getK8sBaseUrl();
    const url = new URL(opts.path, baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${opts.token}`,
      Accept: 'application/json',
    };

    let bodyStr: string | undefined;
    if (opts.body !== undefined) {
      bodyStr = JSON.stringify(opts.body);
      headers['Content-Type'] = opts.contentType ?? 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr).toString();
    }

    const requestOpts: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: opts.method,
      headers,
      timeout: REQUEST_TIMEOUT_MS,
      ...(isHttps && {
        ca: getCaCert(),
        rejectUnauthorized: process.env.K8S_TLS_INSECURE === 'true' ? false : true,
      }),
    };

    const req = client.request(requestOpts, (res) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      res.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_BODY_BYTES) {
          res.destroy();
          reject(new Error(`K8s response body exceeds ${MAX_BODY_BYTES} bytes`));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        let parsed: T;
        try {
          parsed = JSON.parse(raw) as T;
        } catch {
          parsed = raw as unknown as T;
        }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`K8s API request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}
