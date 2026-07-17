import { helmInstall, helmUpgrade, helmUninstall } from './helmService';
import {
  addPluginToConfig,
  removePluginFromConfig,
  getModuleFederationConfig,
  kebabToCamelScope,
} from './dashboardConfigService';
import { getPluginMetadata } from './pluginMetadataClient';
import { getRegistryPlugins } from './charterClient';
import { LifecycleStep, LifecycleResponse, ModuleFederationEntry } from '../types/lifecycle';

function createStep(id: string, label: string): LifecycleStep {
  return { id, label, status: 'pending' };
}

function markRunning(step: LifecycleStep): void {
  step.status = 'running';
}

function markCompleted(step: LifecycleStep): void {
  step.status = 'completed';
}

function markFailed(step: LifecycleStep, error: string): void {
  step.status = 'failed';
  step.error = error;
}

async function resolvePluginChart(pluginName: string): Promise<{
  chart: string;
  repo: string;
  remoteEntry: string;
  scope: string;
  module: string;
}> {
  const registry = await getRegistryPlugins();
  const regEntry = registry.find((p) => p.name === pluginName);
  if (!regEntry) {
    throw new Error(`Plugin "${pluginName}" not found in the registry`);
  }

  const metadata = await getPluginMetadata(regEntry);
  if (!metadata) {
    throw new Error(`Metadata unavailable for plugin "${pluginName}"`);
  }

  if (!metadata.install) {
    throw new Error(`Plugin "${pluginName}" has no install configuration`);
  }

  const chart = metadata.install.helm?.registry ?? metadata.install.helm?.chart_path;
  if (!chart) {
    throw new Error(`Plugin "${pluginName}" has no Helm chart configured`);
  }

  const scope = kebabToCamelScope(pluginName);
  const module = './extensions';

  const remoteEntry = metadata.image?.repository
    ? `http://${pluginName}.${pluginName}.svc.cluster.local:8080/plugin-entry.js`
    : '';

  return { chart, repo: regEntry.repo, remoteEntry, scope, module };
}

export async function installPlugin(
  pluginName: string,
  token: string,
  namespace?: string,
  values?: Record<string, unknown>,
): Promise<LifecycleResponse> {
  const steps: LifecycleStep[] = [
    createStep('resolve', 'Resolve plugin metadata'),
    createStep('helm-install', 'Install Helm chart'),
    createStep('update-config', 'Register plugin in dashboard'),
  ];

  try {
    markRunning(steps[0]);
    const pluginInfo = await resolvePluginChart(pluginName);
    markCompleted(steps[0]);

    const ns = namespace ?? pluginName;
    const releaseName = pluginName;

    markRunning(steps[1]);
    await helmInstall(releaseName, pluginInfo.chart, ns, token, values);
    markCompleted(steps[1]);

    markRunning(steps[2]);
    const mfEntry: ModuleFederationEntry = {
      scope: pluginInfo.scope,
      module: pluginInfo.module,
      remoteEntry: pluginInfo.remoteEntry || `http://${pluginName}.${ns}.svc.cluster.local:8080/plugin-entry.js`,
    };
    await addPluginToConfig(token, mfEntry);
    markCompleted(steps[2]);

    return { success: true, message: `Plugin "${pluginName}" installed successfully`, steps };
  } catch (err) {
    const failedStep = steps.find((s) => s.status === 'running');
    if (failedStep) {
      markFailed(failedStep, err instanceof Error ? err.message : String(err));
    }
    return {
      success: false,
      message: `Failed to install plugin "${pluginName}": ${err instanceof Error ? err.message : String(err)}`,
      steps,
    };
  }
}

export async function upgradePlugin(
  pluginName: string,
  token: string,
  values?: Record<string, unknown>,
): Promise<LifecycleResponse> {
  const steps: LifecycleStep[] = [
    createStep('resolve', 'Resolve plugin metadata'),
    createStep('helm-upgrade', 'Upgrade Helm release'),
  ];

  try {
    markRunning(steps[0]);
    const pluginInfo = await resolvePluginChart(pluginName);
    markCompleted(steps[0]);

    const ns = pluginName;

    markRunning(steps[1]);
    await helmUpgrade(pluginName, pluginInfo.chart, ns, token, values);
    markCompleted(steps[1]);

    return { success: true, message: `Plugin "${pluginName}" upgraded successfully`, steps };
  } catch (err) {
    const failedStep = steps.find((s) => s.status === 'running');
    if (failedStep) {
      markFailed(failedStep, err instanceof Error ? err.message : String(err));
    }
    return {
      success: false,
      message: `Failed to upgrade plugin "${pluginName}": ${err instanceof Error ? err.message : String(err)}`,
      steps,
    };
  }
}

export async function removePlugin(
  pluginName: string,
  token: string,
  deleteNamespace?: boolean,
): Promise<LifecycleResponse> {
  const steps: LifecycleStep[] = [
    createStep('remove-config', 'Remove plugin from dashboard config'),
    createStep('helm-uninstall', 'Uninstall Helm release'),
  ];

  if (deleteNamespace) {
    steps.push(createStep('delete-ns', 'Delete namespace'));
  }

  try {
    markRunning(steps[0]);
    await removePluginFromConfig(token, pluginName);
    markCompleted(steps[0]);

    markRunning(steps[1]);
    await helmUninstall(pluginName, pluginName, token);
    markCompleted(steps[1]);

    if (deleteNamespace) {
      const nsStep = steps.find((s) => s.id === 'delete-ns')!;
      markRunning(nsStep);
      const { k8sRequest } = await import('./k8sApiClient');
      const res = await k8sRequest({
        method: 'DELETE',
        path: `/api/v1/namespaces/${pluginName}`,
        token,
      });
      if (res.status >= 300 && res.status !== 404) {
        throw new Error(`Failed to delete namespace: HTTP ${res.status}`);
      }
      markCompleted(nsStep);
    }

    return { success: true, message: `Plugin "${pluginName}" removed successfully`, steps };
  } catch (err) {
    const failedStep = steps.find((s) => s.status === 'running');
    if (failedStep) {
      markFailed(failedStep, err instanceof Error ? err.message : String(err));
    }
    return {
      success: false,
      message: `Failed to remove plugin "${pluginName}": ${err instanceof Error ? err.message : String(err)}`,
      steps,
    };
  }
}

export async function enablePlugin(
  pluginName: string,
  token: string,
): Promise<LifecycleResponse> {
  const steps: LifecycleStep[] = [
    createStep('resolve', 'Resolve plugin metadata'),
    createStep('enable', 'Add plugin to dashboard config'),
  ];

  try {
    markRunning(steps[0]);
    const pluginInfo = await resolvePluginChart(pluginName);
    markCompleted(steps[0]);

    markRunning(steps[1]);
    const mfEntry: ModuleFederationEntry = {
      scope: pluginInfo.scope,
      module: pluginInfo.module,
      remoteEntry: pluginInfo.remoteEntry || `http://${pluginName}.${pluginName}.svc.cluster.local:8080/plugin-entry.js`,
    };
    await addPluginToConfig(token, mfEntry);
    markCompleted(steps[1]);

    return { success: true, message: `Plugin "${pluginName}" enabled`, steps };
  } catch (err) {
    const failedStep = steps.find((s) => s.status === 'running');
    if (failedStep) {
      markFailed(failedStep, err instanceof Error ? err.message : String(err));
    }
    return {
      success: false,
      message: `Failed to enable plugin "${pluginName}": ${err instanceof Error ? err.message : String(err)}`,
      steps,
    };
  }
}

export async function disablePlugin(
  pluginName: string,
  token: string,
): Promise<LifecycleResponse> {
  const steps: LifecycleStep[] = [
    createStep('disable', 'Remove plugin from dashboard config'),
  ];

  try {
    markRunning(steps[0]);

    const config = await getModuleFederationConfig(token);
    const scope = kebabToCamelScope(pluginName);
    if (!config.some((e) => e.scope === scope)) {
      throw new Error(`Plugin "${pluginName}" is not currently enabled`);
    }

    await removePluginFromConfig(token, pluginName);
    markCompleted(steps[0]);

    return { success: true, message: `Plugin "${pluginName}" disabled`, steps };
  } catch (err) {
    const failedStep = steps.find((s) => s.status === 'running');
    if (failedStep) {
      markFailed(failedStep, err instanceof Error ? err.message : String(err));
    }
    return {
      success: false,
      message: `Failed to disable plugin "${pluginName}": ${err instanceof Error ? err.message : String(err)}`,
      steps,
    };
  }
}
