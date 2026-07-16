import yaml from 'js-yaml';
import { fetchUrl } from '../utils/httpClient';
import { PluginMetadata, RegistryPlugin } from '../types/catalog';

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CONCURRENCY = 5;

interface CacheEntry {
  metadata: PluginMetadata | null;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCacheTtl(): number {
  const envTtl = process.env.PLUGIN_CACHE_TTL_MS;
  if (envTtl) {
    const parsed = parseInt(envTtl, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_CACHE_TTL_MS;
}

function getConcurrency(): number {
  const envVal = process.env.PLUGIN_FETCH_CONCURRENCY;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_CONCURRENCY;
}

function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt < getCacheTtl();
}

function buildRawUrl(plugin: RegistryPlugin): string | null {
  const match = plugin.repo.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, '');
  const branch = plugin.default_branch ?? 'main';
  return `https://raw.githubusercontent.com/${owner}/${cleanRepo}/${branch}/plugin.yaml`;
}

async function fetchPluginYaml(plugin: RegistryPlugin): Promise<PluginMetadata | null> {
  const rawUrl = buildRawUrl(plugin);
  if (!rawUrl) {
    console.warn(`Cannot build raw URL for plugin ${plugin.name}: ${plugin.repo}`);
    return null;
  }

  try {
    const rawYaml = await fetchUrl(rawUrl);
    const parsed = yaml.load(rawYaml) as PluginMetadata;
    if (!parsed || typeof parsed !== 'object' || !parsed.name) {
      console.warn(`Invalid plugin.yaml for ${plugin.name}: missing name field`);
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn(`Failed to fetch plugin.yaml for ${plugin.name}:`, (err as Error).message);
    return null;
  }
}

export async function getPluginMetadata(plugin: RegistryPlugin): Promise<PluginMetadata | null> {
  const cached = cache.get(plugin.name);
  if (cached && isCacheValid(cached)) {
    return cached.metadata;
  }

  const metadata = await fetchPluginYaml(plugin);
  cache.set(plugin.name, { metadata, fetchedAt: Date.now() });
  return metadata;
}

async function runWithConcurrency<T, R>(
  items: T[],
  maxConcurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function getAllPluginMetadata(
  plugins: RegistryPlugin[],
): Promise<Map<string, PluginMetadata | null>> {
  const concurrency = getConcurrency();
  const results = await runWithConcurrency(plugins, concurrency, async (plugin) => ({
    name: plugin.name,
    metadata: await getPluginMetadata(plugin),
  }));

  const map = new Map<string, PluginMetadata | null>();
  for (const result of results) {
    map.set(result.name, result.metadata);
  }
  return map;
}

export function clearPluginCache(name?: string): void {
  if (name) {
    cache.delete(name);
  } else {
    cache.clear();
  }
}
