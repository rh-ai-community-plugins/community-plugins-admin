import https from 'https';
import http from 'http';
import yaml from 'js-yaml';
import { RegistryFile, RegistryPlugin } from '../types/catalog';

const DEFAULT_REGISTRY_URL =
  'https://raw.githubusercontent.com/rh-ai-community-plugins/charter/dev/plugins.yaml';

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  plugins: RegistryPlugin[];
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

function getRegistryUrl(): string {
  return process.env.CHARTER_REGISTRY_URL || DEFAULT_REGISTRY_URL;
}

function getCacheTtl(): number {
  const envTtl = process.env.CHARTER_CACHE_TTL_MS;
  if (envTtl) {
    const parsed = parseInt(envTtl, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_CACHE_TTL_MS;
}

function isCacheValid(): boolean {
  if (!cache) return false;
  return Date.now() - cache.fetchedAt < getCacheTtl();
}

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchUrl(res.headers.location).then(resolve, reject);
          return;
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

export async function getRegistryPlugins(): Promise<RegistryPlugin[]> {
  if (isCacheValid()) {
    return cache!.plugins;
  }

  try {
    const rawYaml = await fetchUrl(getRegistryUrl());
    const parsed = yaml.load(rawYaml) as RegistryFile;

    if (!parsed || !Array.isArray(parsed.plugins)) {
      throw new Error('Invalid registry format: missing plugins array');
    }

    cache = {
      plugins: parsed.plugins,
      fetchedAt: Date.now(),
    };

    return cache.plugins;
  } catch (err) {
    if (cache) {
      console.warn('Charter registry fetch failed, serving stale cache:', (err as Error).message);
      return cache.plugins;
    }
    throw err;
  }
}

export function clearCharterCache(): void {
  cache = null;
}
