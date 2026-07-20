import { k8sRequest } from './k8sApiClient';
import { ModuleFederationEntry } from '../types/lifecycle';

const DASHBOARD_NAMESPACE = process.env.DASHBOARD_NAMESPACE || 'redhat-ods-applications';
const DASHBOARD_DEPLOYMENT = process.env.DASHBOARD_DEPLOYMENT || 'rhods-dashboard';
const MF_ENV_VAR = 'MODULE_FEDERATION_CONFIG';
const MAX_CONCURRENCY_RETRIES = 3;
const CM_REF_ANNOTATION = 'community-plugins-admin/configMapRef';
const CM_REF_ANNOTATION_PATCH = 'community-plugins-admin~1configMapRef';

export function scopeToKebab(scope: string): string {
  return scope.replace(/([A-Z])/g, '-$1').replace(/^-/, '').toLowerCase();
}

export function kebabToCamelScope(name: string): string {
  return name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: {
    configMapKeyRef?: { name: string; key: string };
  };
}

interface DeploymentContainer {
  name: string;
  env?: EnvVar[];
}

interface DashboardDeployment {
  metadata?: {
    resourceVersion?: string;
    annotations?: Record<string, string>;
  };
  spec?: {
    template?: {
      metadata?: {
        annotations?: Record<string, string>;
      };
      spec?: {
        containers?: DeploymentContainer[];
      };
    };
  };
}

class ConflictError extends Error {
  constructor() {
    super('Conflict: resource was modified concurrently (HTTP 409)');
    this.name = 'ConflictError';
  }
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

async function readDeployment(
  token: string,
): Promise<{ body: DashboardDeployment; resourceVersion: string | undefined }> {
  const path = `/apis/apps/v1/namespaces/${DASHBOARD_NAMESPACE}/deployments/${DASHBOARD_DEPLOYMENT}`;
  const res = await k8sRequest<DashboardDeployment>({ method: 'GET', path, token });

  if (res.status !== 200) {
    throw new Error(`Failed to read dashboard deployment: HTTP ${res.status}`);
  }

  return {
    body: res.body,
    resourceVersion: res.body.metadata?.resourceVersion,
  };
}

function findMfEnvVar(deployment: DashboardDeployment): { envVar: EnvVar | undefined; containerIndex: number; envIndex: number } {
  const containers = deployment.spec?.template?.spec?.containers ?? [];
  for (let ci = 0; ci < containers.length; ci++) {
    const envVars = containers[ci].env ?? [];
    for (let ei = 0; ei < envVars.length; ei++) {
      if (envVars[ei].name === MF_ENV_VAR) {
        return { envVar: envVars[ei], containerIndex: ci, envIndex: ei };
      }
    }
  }
  return { envVar: undefined, containerIndex: -1, envIndex: -1 };
}

async function readConfigMapValue(
  token: string,
  namespace: string,
  cmName: string,
  cmKey: string,
): Promise<string> {
  const path = `/api/v1/namespaces/${namespace}/configmaps/${cmName}`;
  const res = await k8sRequest<{ data?: Record<string, string> }>({ method: 'GET', path, token });
  if (res.status !== 200) {
    throw new Error(`Failed to read ConfigMap "${cmName}": HTTP ${res.status}`);
  }
  const value = res.body.data?.[cmKey];
  if (value === undefined) {
    throw new Error(`Key "${cmKey}" not found in ConfigMap "${cmName}"`);
  }
  return value;
}

function parseConfigMapRef(annotation: string): { name: string; key: string } | undefined {
  const slashIdx = annotation.indexOf('/');
  if (slashIdx <= 0) return undefined;
  return { name: annotation.substring(0, slashIdx), key: annotation.substring(slashIdx + 1) };
}

interface ConfigSource {
  source: 'inline' | 'configmap' | 'missing';
  entries: ModuleFederationEntry[];
  deployment: DashboardDeployment;
  resourceVersion: string | undefined;
  containerIndex: number;
  envIndex: number;
  cmName?: string;
  cmKey?: string;
}

async function readCurrentConfig(token: string): Promise<ConfigSource> {
  const { body, resourceVersion } = await readDeployment(token);
  const { envVar, containerIndex, envIndex } = findMfEnvVar(body);

  // Determine ConfigMap reference: from valueFrom (first time) or saved annotation (subsequent)
  let cmRef: { name: string; key: string } | undefined;

  if (envVar?.valueFrom?.configMapKeyRef) {
    cmRef = envVar.valueFrom.configMapKeyRef;
  } else {
    const annotation = body.metadata?.annotations?.[CM_REF_ANNOTATION];
    if (annotation) {
      cmRef = parseConfigMapRef(annotation);
    }
  }

  // If ConfigMap reference is known, resync: read fresh entries from ConfigMap
  // and merge with community entries from inline value
  if (cmRef) {
    try {
      const raw = await readConfigMapValue(token, DASHBOARD_NAMESPACE, cmRef.name, cmRef.key);
      const cmEntries = JSON.parse(raw);
      if (!Array.isArray(cmEntries)) {
        throw new Error(`${MF_ENV_VAR} in ConfigMap "${cmRef.name}" is not an array`);
      }

      // Community entries = inline entries whose name is NOT in the ConfigMap
      let communityEntries: ModuleFederationEntry[] = [];
      if (envVar?.value) {
        try {
          const inlineEntries = JSON.parse(envVar.value);
          if (Array.isArray(inlineEntries)) {
            const cmNames = new Set((cmEntries as ModuleFederationEntry[]).map((e) => e.name));
            communityEntries = (inlineEntries as ModuleFederationEntry[]).filter((e) => !cmNames.has(e.name));
          }
        } catch {
          // Invalid inline JSON — ConfigMap entries are authoritative
        }
      }

      const merged = [...(cmEntries as ModuleFederationEntry[]), ...communityEntries];
      console.log(`[MF Config] Resynced: ${cmEntries.length} from ConfigMap "${cmRef.name}" + ${communityEntries.length} community entries`);

      return {
        source: 'configmap',
        entries: merged,
        deployment: body,
        resourceVersion,
        containerIndex: containerIndex >= 0 ? containerIndex : findDashboardContainerIndex(body),
        envIndex,
        cmName: cmRef.name,
        cmKey: cmRef.key,
      };
    } catch (err) {
      // If the env var uses valueFrom and we can't read the ConfigMap, refuse to proceed
      // to avoid overwriting the reference with an empty array
      if (envVar?.valueFrom) {
        throw err;
      }
      console.warn(`[MF Config] Failed to read ConfigMap "${cmRef.name}": ${(err as Error).message} — falling back to inline`);
    }
  }

  // No ConfigMap reference or ConfigMap read failed with inline fallback
  if (!envVar) {
    console.log('[MF Config] ENV var not found — source=missing');
    return { source: 'missing', entries: [], deployment: body, resourceVersion, containerIndex: -1, envIndex: -1 };
  }

  if (envVar.value) {
    const parsed = JSON.parse(envVar.value);
    if (!Array.isArray(parsed)) {
      throw new Error(`${MF_ENV_VAR} is not an array`);
    }
    console.log(`[MF Config] source=inline — ${parsed.length} entries`);
    return { source: 'inline', entries: parsed as ModuleFederationEntry[], deployment: body, resourceVersion, containerIndex, envIndex };
  }

  console.log('[MF Config] ENV var exists but no value or valueFrom — source=missing');
  return { source: 'missing', entries: [], deployment: body, resourceVersion, containerIndex, envIndex };
}

function findDashboardContainerIndex(deployment: DashboardDeployment): number {
  const containers = deployment.spec?.template?.spec?.containers ?? [];
  const idx = containers.findIndex((c) => c.name === DASHBOARD_DEPLOYMENT);
  return idx >= 0 ? idx : 0;
}

// ---------------------------------------------------------------------------
// Write helper
// ---------------------------------------------------------------------------

async function writeConfig(
  token: string,
  config: ConfigSource,
  entries: ModuleFederationEntry[],
): Promise<void> {
  const configValue = JSON.stringify(entries);
  const deployPath = `/apis/apps/v1/namespaces/${DASHBOARD_NAMESPACE}/deployments/${DASHBOARD_DEPLOYMENT}`;

  type PatchOp = { op: string; path: string; value: unknown };

  const testOps: PatchOp[] = config.resourceVersion
    ? [{ op: 'test', path: '/metadata/resourceVersion', value: config.resourceVersion }]
    : [];

  // Env var patch
  const envOps: PatchOp[] = [];
  if (config.containerIndex >= 0 && config.envIndex >= 0) {
    envOps.push({
      op: 'replace',
      path: `/spec/template/spec/containers/${config.containerIndex}/env/${config.envIndex}`,
      value: { name: MF_ENV_VAR, value: configValue },
    });
  } else {
    const containers = config.deployment.spec?.template?.spec?.containers ?? [];
    const targetIndex = containers.findIndex((c) => c.name === DASHBOARD_DEPLOYMENT);
    const ci = targetIndex >= 0 ? targetIndex : 0;
    const hasEnvArray = Array.isArray(containers[ci]?.env);
    envOps.push(hasEnvArray
      ? { op: 'add', path: `/spec/template/spec/containers/${ci}/env/-`, value: { name: MF_ENV_VAR, value: configValue } }
      : { op: 'add', path: `/spec/template/spec/containers/${ci}/env`, value: [{ name: MF_ENV_VAR, value: configValue }] },
    );
  }

  // Save ConfigMap reference annotation so future operations can resync
  const annotationOps: PatchOp[] = [];
  if (config.cmName && config.cmKey) {
    const refValue = `${config.cmName}/${config.cmKey}`;
    if (config.deployment.metadata?.annotations) {
      annotationOps.push({ op: 'add', path: `/metadata/annotations/${CM_REF_ANNOTATION_PATCH}`, value: refValue });
    } else {
      annotationOps.push({ op: 'add', path: '/metadata/annotations', value: { [CM_REF_ANNOTATION]: refValue } });
    }
  }

  console.log(`[MF Config] Writing ${entries.length} entries inline (source was ${config.source}${config.cmName ? ', saving ConfigMap ref' : ''})`);

  const patch = [...testOps, ...envOps, ...annotationOps];
  const res = await k8sRequest({
    method: 'PATCH',
    path: deployPath,
    token,
    body: patch,
    contentType: 'application/json-patch+json',
  });

  if (res.status === 409 || res.status === 422) {
    const body = res.body as { message?: string };
    const msg = body?.message ?? '';
    if (res.status === 409 || msg.includes('testing value') || msg.includes('does not match')) {
      throw new ConflictError();
    }
    throw new Error(`Failed to patch ${MF_ENV_VAR}: HTTP ${res.status} — ${msg}`);
  }

  if (res.status !== 200) {
    const body = res.body as { message?: string };
    const msg = body?.message ? ` — ${body.message}` : '';
    throw new Error(`Failed to patch ${MF_ENV_VAR}: HTTP ${res.status}${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Retry wrapper
// ---------------------------------------------------------------------------

async function withRetryOnConflict(fn: () => Promise<void>): Promise<void> {
  for (let attempt = 0; attempt < MAX_CONCURRENCY_RETRIES; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      if (err instanceof ConflictError && attempt < MAX_CONCURRENCY_RETRIES - 1) {
        continue;
      }
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getModuleFederationConfig(
  token: string,
): Promise<ModuleFederationEntry[]> {
  const config = await readCurrentConfig(token);
  return config.entries;
}

export async function addPluginToConfig(
  token: string,
  entry: ModuleFederationEntry,
): Promise<void> {
  await withRetryOnConflict(async () => {
    const config = await readCurrentConfig(token);

    if (config.entries.some((e) => e.name === entry.name)) {
      throw new Error(`Plugin "${scopeToKebab(entry.name)}" is already in ${MF_ENV_VAR}`);
    }

    const updated = [...config.entries, entry];
    await writeConfig(token, config, updated);
  });
}

export async function removePluginFromConfig(
  token: string,
  pluginName: string,
  { optional = false }: { optional?: boolean } = {},
): Promise<boolean> {
  let removed = false;
  await withRetryOnConflict(async () => {
    const config = await readCurrentConfig(token);

    const entry = config.entries.find((e) => scopeToKebab(e.name) === pluginName);

    if (!entry) {
      if (optional) {
        removed = false;
        return;
      }
      throw new Error(`Plugin "${pluginName}" not found in ${MF_ENV_VAR}`);
    }

    const updated = config.entries.filter((e) => e.name !== entry.name);
    await writeConfig(token, config, updated);
    removed = true;
  });
  return removed;
}
