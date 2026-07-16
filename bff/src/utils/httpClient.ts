import https from 'https';
import http from 'http';

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

export function fetchUrl(url: string, redirectsRemaining = MAX_REDIRECTS): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client
      .get(url, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsRemaining <= 0) {
            res.resume();
            reject(new Error(`Too many redirects fetching ${url}`));
            return;
          }
          res.resume();
          fetchUrl(res.headers.location, redirectsRemaining - 1).then(resolve, reject);
          return;
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_BODY_BYTES) {
            res.destroy();
            reject(new Error(`Response body exceeds ${MAX_BODY_BYTES} bytes from ${url}`));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        res.on('error', reject);
      })
      .on('error', reject);

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms fetching ${url}`));
    });
  });
}
