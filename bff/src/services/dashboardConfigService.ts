import { k8sRequest } from './k8sApiClient';
import { ModuleFederationEntry } from '../types/lifecycle';

const DASHBOARD_NAMESPACE = 'redhat-ods-applications';
const DASHBOARD_DEPLOYMENT = 'rhods-dashboard';
const MF_ENV_VAR = 'MODULE_FEDERATION_CONFIG';

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
  spec?: {
    template?: {
      spec?: {
        containers?: DeploymentContainer[];
      };
    };
  };
}

export async function getModuleFederationConfig(
  token: string,
): Promise<ModuleFederationEntry[]> {
  const path = `/apis/apps/v1/namespaces/${DASHBOARD_NAMESPACE}/deployments/${DASHBOARD_DEPLOYMENT}`;
  const res = await k8sRequest<DashboardDeployment>({ method: 'GET', path, token });

  if (res.status !== 200) {
    throw new Error(`Failed to read dashboard deployment: HTTP ${res.status}`);
  }

  const containers = res.body.spec?.template?.spec?.containers ?? [];
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

export async function addPluginToConfig(
  token: string,
  entry: ModuleFederationEntry,
): Promise<void> {
  const current = await getModuleFederationConfig(token);

  if (current.some((e) => e.scope === entry.scope)) {
    throw new Error(`Plugin "${scopeToKebab(entry.scope)}" is already in ${MF_ENV_VAR}`);
  }

  const updated = [...current, entry];
  await patchModuleFederationConfig(token, updated);
}

export async function removePluginFromConfig(
  token: string,
  pluginName: string,
): Promise<void> {
  const scope = kebabToCamelScope(pluginName);
  const current = await getModuleFederationConfig(token);
  const updated = current.filter((e) => e.scope !== scope);

  if (updated.length === current.length) {
    throw new Error(`Plugin "${pluginName}" not found in ${MF_ENV_VAR}`);
  }

  await patchModuleFederationConfig(token, updated);
}

async function patchModuleFederationConfig(
  token: string,
  entries: ModuleFederationEntry[],
): Promise<void> {
  const path = `/apis/apps/v1/namespaces/${DASHBOARD_NAMESPACE}/deployments/${DASHBOARD_DEPLOYMENT}`;

  const res = await k8sRequest<DashboardDeployment>({ method: 'GET', path, token });
  if (res.status !== 200) {
    throw new Error(`Failed to read dashboard deployment for patching: HTTP ${res.status}`);
  }

  const containers = res.body.spec?.template?.spec?.containers ?? [];
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

  if (containerIndex >= 0 && envIndex >= 0) {
    const patch = [
      {
        op: 'replace' as const,
        path: `/spec/template/spec/containers/${containerIndex}/env/${envIndex}/value`,
        value: configValue,
      },
    ];

    const patchRes = await k8sRequest({
      method: 'PATCH',
      path,
      token,
      body: patch,
      contentType: 'application/json-patch+json',
    });

    if (patchRes.status !== 200) {
      throw new Error(`Failed to patch ${MF_ENV_VAR}: HTTP ${patchRes.status}`);
    }
  } else {
    const targetIndex = containers.findIndex((c) => c.name === DASHBOARD_DEPLOYMENT);
    const ci = targetIndex >= 0 ? targetIndex : 0;
    const patch = [
      {
        op: 'add' as const,
        path: `/spec/template/spec/containers/${ci}/env/-`,
        value: { name: MF_ENV_VAR, value: configValue },
      },
    ];

    const patchRes = await k8sRequest({
      method: 'PATCH',
      path,
      token,
      body: patch,
      contentType: 'application/json-patch+json',
    });

    if (patchRes.status !== 200) {
      throw new Error(`Failed to add ${MF_ENV_VAR}: HTTP ${patchRes.status}`);
    }
  }
}
