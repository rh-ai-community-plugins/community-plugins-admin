import { helmInstall, helmUpgrade, helmUninstall, discoverReleaseNamespace } from './helmService';
import {
  addPluginToConfig,
  removePluginFromConfig,
  kebabToCamelScope,
} from './dashboardConfigService';
import { k8sRequest } from './k8sApiClient';
import { getPluginMetadata } from './pluginMetadataClient';
import { getRegistryPlugins } from './charterClient';
import { LifecycleStep, LifecycleResponse, LifecycleProgressCallback, ModuleFederationEntry } from '../types/lifecycle';

export function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/--kube-token\s+\S+/g, '--kube-token [REDACTED]')
    .replace(/system:serviceaccount:[^\s"]+/g, '[service-account]')
    .replace(/https?:\/\/\d+\.\d+\.\d+\.\d+:\d+/g, '[api-server]');
}

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
  namespace?: string;
  version?: string;
  mfName: string;
  hasBff: boolean;
  routePath: string;
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

  const ns = metadata.install.namespace;
  const mfName = metadata.remote?.spec?.name ?? metadata.remote?.spec?.scope ?? kebabToCamelScope(pluginName);
  const hasBff = !!metadata.bff_image;
  const routeSpec = metadata.remote?.spec?.paths?.find((p) => p.type === 'route');
  const routePath = routeSpec?.path ?? `/${pluginName}`;

  return { chart, repo: regEntry.repo, namespace: ns, version: metadata.version, mfName, hasBff, routePath };
}

export async function installPlugin(
  pluginName: string,
  token: string,
  namespace?: string,
  values?: Record<string, unknown>,
  onProgress?: LifecycleProgressCallback,
): Promise<LifecycleResponse> {
  const steps: LifecycleStep[] = [
    createStep('resolve', 'Resolve plugin metadata'),
    createStep('helm-install', 'Install Helm chart'),
    createStep('update-config', 'Register plugin in dashboard'),
  ];
  onProgress?.(steps);

  let pluginInfo: Awaited<ReturnType<typeof resolvePluginChart>> | undefined;
  try {
    markRunning(steps[0]);
    onProgress?.(steps);
    pluginInfo = await resolvePluginChart(pluginName);
    markCompleted(steps[0]);
    onProgress?.(steps);

    const ns = namespace ?? pluginInfo.namespace ?? pluginName;
    const releaseName = pluginName;

    markRunning(steps[1]);
    onProgress?.(steps);
    await helmInstall(releaseName, pluginInfo.chart, ns, token, { namespace: ns, ...values }, pluginInfo.version);
    markCompleted(steps[1]);
    onProgress?.(steps);

    markRunning(steps[2]);
    onProgress?.(steps);
    const mfEntry: ModuleFederationEntry = {
      name: pluginInfo.mfName,
      backend: {
        remoteEntry: '/remoteEntry.js',
        tls: false,
        service: { name: pluginName, namespace: ns, port: 8080 },
      },
      ...(pluginInfo.hasBff ? {
        proxyService: [{
          path: `${pluginInfo.routePath}/api`,
          pathRewrite: '/api',
          authorize: true,
          tls: false,
          service: { name: `${pluginName}-bff`, namespace: ns, port: 3000 },
        }],
      } : {}),
    };
    await addPluginToConfig(token, mfEntry);
    markCompleted(steps[2]);
    onProgress?.(steps);

    return { success: true, message: `Plugin "${pluginName}" installed successfully`, steps };
  } catch (err) {
    const failedStep = steps.find((s) => s.status === 'running');
    if (failedStep) {
      markFailed(failedStep, sanitizeErrorMessage(err));
      onProgress?.(steps);
    }

    const helmStep = steps.find((s) => s.id === 'helm-install');
    if (helmStep && (helmStep.status === 'completed' || helmStep.status === 'failed')) {
      const ns = namespace ?? pluginInfo?.namespace ?? pluginName;
      const cleanupStep = createStep('cleanup', 'Rolling back Helm release');
      steps.push(cleanupStep);
      markRunning(cleanupStep);
      onProgress?.(steps);
      try {
        await helmUninstall(pluginName, ns, token);
        markCompleted(cleanupStep);
      } catch (cleanupErr) {
        markFailed(cleanupStep, sanitizeErrorMessage(cleanupErr));
      }
      onProgress?.(steps);
    }

    return {
      success: false,
      message: `Failed to install plugin "${pluginName}": ${sanitizeErrorMessage(err)}`,
      steps,
    };
  }
}

export async function upgradePlugin(
  pluginName: string,
  token: string,
  namespace?: string,
  values?: Record<string, unknown>,
  onProgress?: LifecycleProgressCallback,
): Promise<LifecycleResponse> {
  const steps: LifecycleStep[] = [
    createStep('resolve', 'Resolve plugin metadata'),
    createStep('helm-upgrade', 'Upgrade Helm release'),
  ];
  onProgress?.(steps);

  try {
    markRunning(steps[0]);
    onProgress?.(steps);
    const pluginInfo = await resolvePluginChart(pluginName);
    markCompleted(steps[0]);
    onProgress?.(steps);

    const ns = namespace ?? (await discoverReleaseNamespace(pluginName, token)) ?? pluginInfo.namespace ?? pluginName;

    markRunning(steps[1]);
    onProgress?.(steps);
    await helmUpgrade(pluginName, pluginInfo.chart, ns, token, { namespace: ns, ...values }, pluginInfo.version);
    markCompleted(steps[1]);
    onProgress?.(steps);

    return { success: true, message: `Plugin "${pluginName}" upgraded successfully`, steps };
  } catch (err) {
    const failedStep = steps.find((s) => s.status === 'running');
    if (failedStep) {
      markFailed(failedStep, sanitizeErrorMessage(err));
      onProgress?.(steps);
    }
    return {
      success: false,
      message: `Failed to upgrade plugin "${pluginName}": ${sanitizeErrorMessage(err)}`,
      steps,
    };
  }
}

export async function removePlugin(
  pluginName: string,
  token: string,
  deleteNamespace?: boolean,
  namespace?: string,
  onProgress?: LifecycleProgressCallback,
): Promise<LifecycleResponse> {
  const steps: LifecycleStep[] = [
    createStep('remove-config', 'Remove plugin from dashboard config'),
    createStep('helm-uninstall', 'Uninstall Helm release'),
  ];

  if (deleteNamespace) {
    steps.push(createStep('delete-ns', 'Delete namespace'));
  }
  onProgress?.(steps);

  try {
    const ns = namespace ?? (await discoverReleaseNamespace(pluginName, token)) ?? pluginName;

    markRunning(steps[0]);
    onProgress?.(steps);
    const wasRegistered = await removePluginFromConfig(token, pluginName, { optional: true });
    markCompleted(steps[0]);
    if (!wasRegistered) {
      steps[0].label = 'Plugin was not registered in dashboard config (skipped)';
    }
    onProgress?.(steps);

    markRunning(steps[1]);
    onProgress?.(steps);
    await helmUninstall(pluginName, ns, token);
    markCompleted(steps[1]);
    onProgress?.(steps);

    if (deleteNamespace) {
      const nsStep = steps.find((s) => s.id === 'delete-ns')!;
      markRunning(nsStep);
      onProgress?.(steps);
      const res = await k8sRequest({
        method: 'DELETE',
        path: `/api/v1/namespaces/${ns}`,
        token,
      });
      if (res.status >= 300 && res.status !== 404) {
        throw new Error(`Failed to delete namespace: HTTP ${res.status}`);
      }
      markCompleted(nsStep);
      onProgress?.(steps);
    }

    return { success: true, message: `Plugin "${pluginName}" removed successfully`, steps };
  } catch (err) {
    const failedStep = steps.find((s) => s.status === 'running');
    if (failedStep) {
      markFailed(failedStep, sanitizeErrorMessage(err));
      onProgress?.(steps);
    }
    return {
      success: false,
      message: `Failed to remove plugin "${pluginName}": ${sanitizeErrorMessage(err)}`,
      steps,
    };
  }
}

export async function enablePlugin(
  pluginName: string,
  token: string,
  onProgress?: LifecycleProgressCallback,
): Promise<LifecycleResponse> {
  const steps: LifecycleStep[] = [
    createStep('resolve', 'Resolve plugin metadata'),
    createStep('enable', 'Add plugin to dashboard config'),
  ];
  onProgress?.(steps);

  try {
    markRunning(steps[0]);
    onProgress?.(steps);
    const pluginInfo = await resolvePluginChart(pluginName);
    markCompleted(steps[0]);
    onProgress?.(steps);

    markRunning(steps[1]);
    onProgress?.(steps);

    const ns = (await discoverReleaseNamespace(pluginName, token)) ?? pluginInfo.namespace ?? pluginName;
    const mfEntry: ModuleFederationEntry = {
      name: pluginInfo.mfName,
      backend: {
        remoteEntry: '/remoteEntry.js',
        tls: false,
        service: { name: pluginName, namespace: ns, port: 8080 },
      },
      ...(pluginInfo.hasBff ? {
        proxyService: [{
          path: `${pluginInfo.routePath}/api`,
          pathRewrite: '/api',
          authorize: true,
          tls: false,
          service: { name: `${pluginName}-bff`, namespace: ns, port: 3000 },
        }],
      } : {}),
    };
    await addPluginToConfig(token, mfEntry);
    markCompleted(steps[1]);
    onProgress?.(steps);

    return { success: true, message: `Plugin "${pluginName}" enabled`, steps };
  } catch (err) {
    const failedStep = steps.find((s) => s.status === 'running');
    if (failedStep) {
      markFailed(failedStep, sanitizeErrorMessage(err));
      onProgress?.(steps);
    }
    return {
      success: false,
      message: `Failed to enable plugin "${pluginName}": ${sanitizeErrorMessage(err)}`,
      steps,
    };
  }
}

export async function disablePlugin(
  pluginName: string,
  token: string,
  onProgress?: LifecycleProgressCallback,
): Promise<LifecycleResponse> {
  const steps: LifecycleStep[] = [
    createStep('disable', 'Remove plugin from dashboard config'),
  ];
  onProgress?.(steps);

  try {
    markRunning(steps[0]);
    onProgress?.(steps);
    await removePluginFromConfig(token, pluginName);
    markCompleted(steps[0]);
    onProgress?.(steps);

    return { success: true, message: `Plugin "${pluginName}" disabled`, steps };
  } catch (err) {
    const failedStep = steps.find((s) => s.status === 'running');
    if (failedStep) {
      markFailed(failedStep, sanitizeErrorMessage(err));
      onProgress?.(steps);
    }
    return {
      success: false,
      message: `Failed to disable plugin "${pluginName}": ${sanitizeErrorMessage(err)}`,
      steps,
    };
  }
}
