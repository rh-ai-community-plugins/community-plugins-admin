import { execFile } from 'child_process';
import { getK8sBaseUrl } from '../utils/k8sClient';

const HELM_TIMEOUT_MS = 120_000;
const HELM_BIN = process.env.HELM_BIN || 'helm';

interface HelmResult {
  stdout: string;
  stderr: string;
}

function runHelm(args: string[], token: string): Promise<HelmResult> {
  const baseUrl = getK8sBaseUrl();

  const fullArgs = [
    ...args,
    '--kube-apiserver', baseUrl,
    '--kube-token', token,
    '--kube-insecure-skip-tls-verify=false',
  ];

  return new Promise((resolve, reject) => {
    const proc = execFile(
      HELM_BIN,
      fullArgs,
      {
        timeout: HELM_TIMEOUT_MS,
        maxBuffer: 5 * 1024 * 1024,
        env: { ...process.env, HELM_CACHE_HOME: '/tmp/helm/cache', HELM_CONFIG_HOME: '/tmp/helm/config', HELM_DATA_HOME: '/tmp/helm/data' },
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Helm command failed: ${stderr || error.message}`));
          return;
        }
        resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
      },
    );

    proc.on('error', (err) => {
      reject(new Error(`Failed to execute helm: ${err.message}`));
    });
  });
}

export async function helmInstall(
  releaseName: string,
  chart: string,
  namespace: string,
  token: string,
  values?: Record<string, unknown>,
): Promise<string> {
  const args = [
    'install', releaseName, chart,
    '--namespace', namespace,
    '--create-namespace',
    '--wait',
    '--timeout', '5m',
    '--output', 'json',
  ];

  if (values) {
    for (const [key, val] of Object.entries(values)) {
      args.push('--set', `${key}=${String(val)}`);
    }
  }

  const result = await runHelm(args, token);
  return result.stdout;
}

export async function helmUpgrade(
  releaseName: string,
  chart: string,
  namespace: string,
  token: string,
  values?: Record<string, unknown>,
): Promise<string> {
  const args = [
    'upgrade', releaseName, chart,
    '--namespace', namespace,
    '--wait',
    '--timeout', '5m',
    '--output', 'json',
  ];

  if (values) {
    for (const [key, val] of Object.entries(values)) {
      args.push('--set', `${key}=${String(val)}`);
    }
  }

  const result = await runHelm(args, token);
  return result.stdout;
}

export async function helmUninstall(
  releaseName: string,
  namespace: string,
  token: string,
): Promise<string> {
  const args = [
    'uninstall', releaseName,
    '--namespace', namespace,
    '--wait',
    '--timeout', '5m',
  ];

  const result = await runHelm(args, token);
  return result.stdout;
}

export async function helmList(
  namespace: string,
  token: string,
): Promise<string> {
  const args = [
    'list',
    '--namespace', namespace,
    '--output', 'json',
  ];

  const result = await runHelm(args, token);
  return result.stdout;
}
