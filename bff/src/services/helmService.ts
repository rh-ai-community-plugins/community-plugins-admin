import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getK8sBaseUrl } from '../utils/k8sClient';

const HELM_TIMEOUT_MS = 330_000;
const HELM_BIN = process.env.HELM_BIN || 'helm';

export interface HelmRelease {
  name: string;
  namespace: string;
  status: string;
  app_version?: string;
}

const HELM_SET_KEY_PATTERN = /^[a-zA-Z0-9._-]+$/;
const HELM_SET_VALUE_PATTERN = /^[a-zA-Z0-9._:/@=+\- ]*$/;

interface HelmResult {
  stdout: string;
  stderr: string;
}

function sanitizeHelmError(message: string): string {
  return message.replace(/--kubeconfig\s+\S+/g, '--kubeconfig [REDACTED]');
}

const SA_CA_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';

function buildKubeconfig(apiServer: string, token: string): string {
  const clusterLines = [
    `    server: ${apiServer}`,
  ];

  if (process.env.K8S_TLS_INSECURE === 'true') {
    clusterLines.push('    insecure-skip-tls-verify: true');
  } else if (fs.existsSync(SA_CA_PATH)) {
    clusterLines.push(`    certificate-authority: ${SA_CA_PATH}`);
  }

  return [
    'apiVersion: v1',
    'kind: Config',
    'clusters:',
    '- cluster:',
    ...clusterLines,
    '  name: cluster',
    'contexts:',
    '- context:',
    '    cluster: cluster',
    '    user: user',
    '  name: context',
    'current-context: context',
    'users:',
    '- name: user',
    '  user:',
    `    token: "${token}"`,
  ].join('\n');
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

async function runHelm(args: string[], token: string): Promise<HelmResult> {
  const baseUrl = getK8sBaseUrl();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-'));

  try {
    const kubeconfigPath = path.join(tmpDir, 'kubeconfig');
    fs.writeFileSync(kubeconfigPath, buildKubeconfig(baseUrl, token), { mode: 0o600 });

    const fullArgs = [
      ...args,
      '--kube-apiserver', baseUrl,
      '--kubeconfig', kubeconfigPath,
    ];

    return await new Promise<HelmResult>((resolve, reject) => {
      const proc = execFile(
        HELM_BIN,
        fullArgs,
        {
          timeout: HELM_TIMEOUT_MS,
          maxBuffer: 5 * 1024 * 1024,
          env: {
            ...process.env,
            HELM_CACHE_HOME: path.join(tmpDir, 'cache'),
            HELM_CONFIG_HOME: path.join(tmpDir, 'config'),
            HELM_DATA_HOME: path.join(tmpDir, 'data'),
          },
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
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function helmInstall(
  releaseName: string,
  chart: string,
  namespace: string,
  token: string,
  values?: Record<string, unknown>,
  version?: string,
): Promise<string> {
  const args = [
    'install', releaseName, chart,
    '--namespace', namespace,
    '--create-namespace',
    '--wait',
    '--timeout', '5m',
    '--output', 'json',
  ];

  if (version) {
    args.push('--version', version);
  }

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
  version?: string,
): Promise<string> {
  const args = [
    'upgrade', releaseName, chart,
    '--namespace', namespace,
    '--wait',
    '--timeout', '5m',
    '--output', 'json',
  ];

  if (version) {
    args.push('--version', version);
  }

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

export async function discoverReleaseNamespace(
  releaseName: string,
  token: string,
): Promise<string | null> {
  const args = [
    'list',
    '--all-namespaces',
    '--filter', releaseName,
    '--output', 'json',
  ];

  const result = await runHelm(args, token);
  let releases: Array<{ name: string; namespace: string }>;
  try {
    releases = JSON.parse(result.stdout) as Array<{ name: string; namespace: string }>;
  } catch {
    return null;
  }
  const match = releases.find((r) => r.name === releaseName);
  return match?.namespace ?? null;
}

export async function helmListAllNamespaces(token: string): Promise<HelmRelease[]> {
  const args = ['list', '--all-namespaces', '--output', 'json'];
  const result = await runHelm(args, token);
  return JSON.parse(result.stdout) as HelmRelease[];
}
