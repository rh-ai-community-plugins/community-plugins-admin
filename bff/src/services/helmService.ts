import { execFile } from 'child_process';
import { getK8sBaseUrl } from '../utils/k8sClient';

const HELM_TIMEOUT_MS = 120_000;
const HELM_BIN = '/usr/local/bin/helm';

const HELM_SET_KEY_PATTERN = /^[a-zA-Z0-9._-]+$/;
const HELM_SET_VALUE_PATTERN = /^[a-zA-Z0-9._:/@=+\- ]*$/;

interface HelmResult {
  stdout: string;
  stderr: string;
}

function sanitizeHelmError(message: string): string {
  return message.replace(/--kube-token\s+\S+/g, '--kube-token [REDACTED]');
}

export function validateHelmValues(values: unknown): asserts values is Record<string, string | number | boolean> {
  if (typeof values !== 'object' || values === null || Array.isArray(values)) {
    throw new Error('values must be a plain object');
  }
  for (const [key, val] of Object.entries(values)) {
    if (!HELM_SET_KEY_PATTERN.test(key)) {
      throw new Error(`Invalid Helm value key: "${key}"`);
    }
    if (typeof val !== 'string' && typeof val !== 'number' && typeof val !== 'boolean') {
      throw new Error(`Invalid Helm value type for key "${key}": must be string, number, or boolean`);
    }
    const strVal = String(val);
    if (!HELM_SET_VALUE_PATTERN.test(strVal)) {
      throw new Error(`Invalid Helm value for key "${key}"`);
    }
  }
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
          reject(new Error(sanitizeHelmError(`Helm command failed: ${stderr || error.message}`)));
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
    validateHelmValues(values);
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
    validateHelmValues(values);
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
