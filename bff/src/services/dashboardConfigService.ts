import { k8sRequest } from './k8sApiClient';
import { ModuleFederationEntry } from '../types/lifecycle';

const DASHBOARD_NAMESPACE = 'redhat-ods-applications';
const DASHBOARD_DEPLOYMENT = 'rhods-dashboard';
const MF_ENV_VAR = 'MODULE_FEDERATION_CONFIG';
const MAX_CONCURRENCY_RETRIES = 3;

export function scopeToKebab(scope: string): string {
  return scope.replace(/([A-Z])/g, '-$1').replace(/^-/, '').toLowerCase();
}

export function kebabToCamelScope(name: string): string {
  return name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

interface DeploymentContainer {
  name: string;
  env?: Array<{ name: string; value?: string }>;
}

interface DashboardDeployment {
  metadata?: {
    resourceVersion?: string;
  };
  spec?: {
    template?: {
      spec?: {
        containers?: DeploymentContainer[];
      };
    };
  };
}

/**
 * Thrown when a JSON Patch is rejected with HTTP 409 (Conflict), indicating
 * the deployment was modified by another request between our read and write.
 * Caught internally by withRetryOnConflict — never surfaces to callers.
 */
class ConflictError extends Error {
  constructor() {
    super('Conflict: resource was modified concurrently (HTTP 409)');
    this.name = 'ConflictError';
  }
}

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

function parseModuleFederationConfig(deployment: DashboardDeployment): ModuleFederationEntry[] {
  const containers = deployment.spec?.template?.spec?.containers ?? [];
  for (const container of containers) {
    const envVar = (container.env ?? []).find((e) => e.name === MF_ENV_VAR);
    if (envVar?.value) {
      const parsed: unknown = JSON.parse(envVar.value);
      if (!Array.isArray(parsed)) {
        throw new Error(`${MF_ENV_VAR} is not an array`);
      }
      return parsed as ModuleFederationEntry[];
    }
  }
  return [];
}

export async function getModuleFederationConfig(
  token: string,
): Promise<ModuleFederationEntry[]> {
  const { body } = await readDeployment(token);
  return parseModuleFederationConfig(body);
}

/**
 * Runs `fn` up to MAX_CONCURRENCY_RETRIES times. On each attempt, if the
 * Kubernetes API rejects the patch with HTTP 409 (Conflict) a ConflictError
 * is thrown by patchModuleFederationConfig; this wrapper catches it and
 * re-executes `fn` so it re-reads the latest deployment state before retrying
 * the patch. Non-conflict errors are rethrown immediately.
 */
async function withRetryOnConflict(fn: () => Promise<void>): Promise<void> {
  for (let attempt = 0; attempt < MAX_CONCURRENCY_RETRIES; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      if (err instanceof ConflictError && attempt < MAX_CONCURRENCY_RETRIES - 1) {
        // Conflict — retry with a fresh read of the deployment
        continue;
      }
      throw err;
    }
  }
}

export async function addPluginToConfig(
  token: string,
  entry: ModuleFederationEntry,
): Promise<void> {
  await withRetryOnConflict(async () => {
    const { body, resourceVersion } = await readDeployment(token);
    const current = parseModuleFederationConfig(body);

    if (current.some((e) => e.scope === entry.scope)) {
      throw new Error(`Plugin "${scopeToKebab(entry.scope)}" is already in ${MF_ENV_VAR}`);
    }

    const updated = [...current, entry];
    await patchModuleFederationConfig(token, updated, body, resourceVersion);
  });
}

export async function removePluginFromConfig(
  token: string,
  pluginName: string,
): Promise<void> {
  await withRetryOnConflict(async () => {
    const { body, resourceVersion } = await readDeployment(token);
    const current = parseModuleFederationConfig(body);

    // Find the entry by converting each stored scope back to kebab-case rather
    // than re-deriving the scope via kebabToCamelScope. This handles scopes in
    // any case (camelCase, PascalCase, etc.) because addPluginToConfig stores
    // whatever scope the plugin.yaml declares (e.g. "CommunityPluginsAdmin"),
    // while kebabToCamelScope would only ever produce "communityPluginsAdmin".
    const entry = current.find((e) => scopeToKebab(e.scope) === pluginName);

    if (!entry) {
      throw new Error(`Plugin "${pluginName}" not found in ${MF_ENV_VAR}`);
    }

    const updated = current.filter((e) => e.scope !== entry.scope);
    await patchModuleFederationConfig(token, updated, body, resourceVersion);
  });
}

async function patchModuleFederationConfig(
  token: string,
  entries: ModuleFederationEntry[],
  deployment: DashboardDeployment,
  resourceVersion: string | undefined,
): Promise<void> {
  const path = `/apis/apps/v1/namespaces/${DASHBOARD_NAMESPACE}/deployments/${DASHBOARD_DEPLOYMENT}`;

  const containers = deployment.spec?.template?.spec?.containers ?? [];
  let containerIndex = -1;
  let envIndex = -1;

  for (let ci = 0; ci < containers.length; ci++) {
    const envVars = containers[ci].env ?? [];
    for (let ei = 0; ei < envVars.length; ei++) {
      if (envVars[ei].name === MF_ENV_VAR) {
        containerIndex = ci;
        envIndex = ei;
        break;
      }
    }
    if (containerIndex >= 0) break;
  }

  const configValue = JSON.stringify(entries);

  // Prepend a JSON Patch test operation to verify the resourceVersion hasn't
  // changed since we last read the deployment (RFC 6902 §4.6). Kubernetes
  // evaluates test ops before applying the patch and rejects the entire
  // request with HTTP 409 if the test fails, giving us optimistic
  // concurrency control with no extra round-trip.
  type PatchOp = { op: string; path: string; value: unknown };
  const testOps: PatchOp[] = resourceVersion
    ? [{ op: 'test', path: '/metadata/resourceVersion', value: resourceVersion }]
    : [];

  let mutationOps: PatchOp[];
  let errorVerb: string;

  if (containerIndex >= 0 && envIndex >= 0) {
    mutationOps = [
      {
        op: 'replace',
        path: `/spec/template/spec/containers/${containerIndex}/env/${envIndex}/value`,
        value: configValue,
      },
    ];
    errorVerb = 'patch';
  } else {
    const targetIndex = containers.findIndex((c) => c.name === DASHBOARD_DEPLOYMENT);
    const ci = targetIndex >= 0 ? targetIndex : 0;
    const targetContainer = containers[ci];
    const hasEnvArray = Array.isArray(targetContainer?.env);

    // RFC 6902 §4.1: `env/-` appends to an existing array; if `env` does not
    // exist on the container yet (fresh dashboard install), use `env` without
    // the `/-` suffix to create the array.
    mutationOps = hasEnvArray
      ? [
          {
            op: 'add',
            path: `/spec/template/spec/containers/${ci}/env/-`,
            value: { name: MF_ENV_VAR, value: configValue },
          },
        ]
      : [
          {
            op: 'add',
            path: `/spec/template/spec/containers/${ci}/env`,
            value: [{ name: MF_ENV_VAR, value: configValue }],
          },
        ];
    errorVerb = 'add';
  }

  const patch = [...testOps, ...mutationOps];
  const patchRes = await k8sRequest({
    method: 'PATCH',
    path,
    token,
    body: patch,
    contentType: 'application/json-patch+json',
  });

  if (patchRes.status === 409) {
    throw new ConflictError();
  }

  if (patchRes.status !== 200) {
    throw new Error(`Failed to ${errorVerb} ${MF_ENV_VAR}: HTTP ${patchRes.status}`);
  }
}
