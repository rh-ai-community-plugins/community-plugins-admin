import { helmInstall, helmUpgrade, helmUninstall, validateHelmValues, discoverReleaseNamespace, helmListAllNamespaces } from '../src/services/helmService';
import { execFile } from 'child_process';
import * as fs from 'fs';
import { getK8sBaseUrl } from '../src/utils/k8sClient';

jest.mock('child_process');
jest.mock('fs');
jest.mock('../src/utils/k8sClient');

const mockExecFile = execFile as unknown as jest.MockedFunction<
  (cmd: string, args: string[], opts: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => void
>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockGetK8sBaseUrl = getK8sBaseUrl as jest.MockedFunction<typeof getK8sBaseUrl>;

const FAKE_TMP_DIR = '/tmp/helm-abc123';
const FAKE_KUBECONFIG = `${FAKE_TMP_DIR}/kubeconfig`;

beforeEach(() => {
  jest.resetAllMocks();
  mockGetK8sBaseUrl.mockReturnValue('https://k8s.example.com:6443');
  mockFs.mkdtempSync.mockReturnValue(FAKE_TMP_DIR);
  mockFs.writeFileSync.mockImplementation(() => undefined);
  mockFs.rmSync.mockImplementation(() => undefined);
});

describe('validateHelmValues', () => {
  it('accepts valid key-value pairs', () => {
    expect(() => validateHelmValues({ 'image.tag': '2.0.0', replicas: 3, debug: true })).not.toThrow();
  });

  it('rejects non-object values', () => {
    expect(() => validateHelmValues('not-an-object')).toThrow('must be a plain object');
    expect(() => validateHelmValues([1, 2])).toThrow('must be a plain object');
    expect(() => validateHelmValues(null)).toThrow('must be a plain object');
  });

  it('rejects keys with special characters', () => {
    expect(() => validateHelmValues({ 'bad;key': 'val' })).toThrow('Invalid Helm value key');
    expect(() => validateHelmValues({ 'key{nested}': 'val' })).toThrow('Invalid Helm value key');
  });

  it('rejects non-primitive values', () => {
    expect(() => validateHelmValues({ key: { nested: 'obj' } })).toThrow('must be string, number, or boolean');
    expect(() => validateHelmValues({ key: [1, 2] })).toThrow('must be string, number, or boolean');
  });

  it('rejects values with dangerous characters', () => {
    expect(() => validateHelmValues({ key: 'val;rm -rf /' })).toThrow('Invalid Helm value');
  });
});

describe('helmInstall', () => {
  it('passes --kubeconfig instead of --kube-token', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '{"name":"test"}', '');
      return undefined as never;
    });

    await helmInstall('my-plugin', 'oci://quay.io/charts/plugin', 'my-ns', 'user-token');

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).not.toContain('--kube-token');
    expect(args).not.toContain('user-token');
    expect(args).toContain('--kubeconfig');
    expect(args).toContain(FAKE_KUBECONFIG);
    expect(args).toContain('install');
    expect(args).toContain('my-plugin');
    expect(args).toContain('oci://quay.io/charts/plugin');
    expect(args).toContain('--namespace');
    expect(args).toContain('my-ns');
    expect(args).toContain('--kube-apiserver');
    expect(args).toContain('https://k8s.example.com:6443');
    expect(args).toContain('--create-namespace');
    expect(args).toContain('--wait');
  });

  it('writes kubeconfig with token to temp file (mode 0o600)', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '{}', '');
      return undefined as never;
    });

    await helmInstall('my-plugin', 'chart', 'ns', 'user-token');

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      FAKE_KUBECONFIG,
      expect.stringContaining('token: "user-token"'),
      { mode: 0o600 },
    );
  });

  it('sets HELM env vars to per-invocation subdirs of the temp dir', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '{}', '');
      return undefined as never;
    });

    await helmInstall('my-plugin', 'chart', 'ns', 'token');

    const opts = mockExecFile.mock.calls[0][2] as { env: NodeJS.ProcessEnv };
    expect(opts.env).toMatchObject({
      HELM_CACHE_HOME: `${FAKE_TMP_DIR}/cache`,
      HELM_CONFIG_HOME: `${FAKE_TMP_DIR}/config`,
      HELM_DATA_HOME: `${FAKE_TMP_DIR}/data`,
    });
  });

  it('cleans up the temp directory after a successful run', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '{}', '');
      return undefined as never;
    });

    await helmInstall('my-plugin', 'chart', 'ns', 'token');

    expect(mockFs.rmSync).toHaveBeenCalledWith(FAKE_TMP_DIR, { recursive: true, force: true });
  });

  it('cleans up the temp directory when helm fails', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(new Error('helm not found'), '', 'command not found');
      return undefined as never;
    });

    await expect(helmInstall('p', 'c', 'n', 't')).rejects.toThrow('Helm command failed');

    expect(mockFs.rmSync).toHaveBeenCalledWith(FAKE_TMP_DIR, { recursive: true, force: true });
  });

  it('includes --set flags for values', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '{}', '');
      return undefined as never;
    });

    await helmInstall('my-plugin', 'chart', 'ns', 'token', { 'image.tag': '2.0.0' });

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).toContain('--set');
    expect(args).toContain('image.tag=2.0.0');
  });

  it('throws on execFile error', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(new Error('helm not found'), '', 'command not found');
      return undefined as never;
    });

    await expect(helmInstall('p', 'c', 'n', 't')).rejects.toThrow('Helm command failed');
  });
});

describe('helmUpgrade', () => {
  it('calls execFile with upgrade command and kubeconfig', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '{}', '');
      return undefined as never;
    });

    await helmUpgrade('my-plugin', 'chart', 'ns', 'token');

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).toContain('upgrade');
    expect(args).toContain('my-plugin');
    expect(args).not.toContain('--kube-token');
    expect(args).not.toContain('token');
    expect(args).toContain('--kubeconfig');
    expect(args).toContain(FAKE_KUBECONFIG);
  });

  it('cleans up the temp directory after a successful run', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '{}', '');
      return undefined as never;
    });

    await helmUpgrade('my-plugin', 'chart', 'ns', 'token');

    expect(mockFs.rmSync).toHaveBeenCalledWith(FAKE_TMP_DIR, { recursive: true, force: true });
  });
});

describe('helmUninstall', () => {
  it('calls execFile with uninstall command and kubeconfig', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, 'release uninstalled', '');
      return undefined as never;
    });

    await helmUninstall('my-plugin', 'ns', 'token');

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).toContain('uninstall');
    expect(args).toContain('my-plugin');
    expect(args).toContain('--namespace');
    expect(args).toContain('ns');
    expect(args).not.toContain('--kube-token');
    expect(args).toContain('--kubeconfig');
    expect(args).toContain(FAKE_KUBECONFIG);
  });

  it('cleans up the temp directory after a successful run', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, 'release uninstalled', '');
      return undefined as never;
    });

    await helmUninstall('my-plugin', 'ns', 'token');

    expect(mockFs.rmSync).toHaveBeenCalledWith(FAKE_TMP_DIR, { recursive: true, force: true });
  });
});

describe('discoverReleaseNamespace', () => {
  it('returns namespace for matching release', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, JSON.stringify([{ name: 'my-plugin', namespace: 'custom-ns', status: 'deployed' }]), '');
      return undefined as never;
    });

    const ns = await discoverReleaseNamespace('my-plugin', 'token');
    expect(ns).toBe('custom-ns');

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).toContain('list');
    expect(args).toContain('--all-namespaces');
    expect(args).toContain('--filter');
    expect(args).toContain('my-plugin');
    expect(args).toContain('--output');
    expect(args).toContain('json');
  });

  it('returns null when no release matches the name exactly', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      // helm --filter is regex-based, so "my-plugin" may return "my-plugin-extra" too;
      // the code does an exact match, so this should return null
      cb(null, JSON.stringify([{ name: 'my-plugin-extra', namespace: 'ns-extra', status: 'deployed' }]), '');
      return undefined as never;
    });

    const ns = await discoverReleaseNamespace('my-plugin', 'token');
    expect(ns).toBeNull();
  });

  it('returns null when the releases list is empty', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, JSON.stringify([]), '');
      return undefined as never;
    });

    const ns = await discoverReleaseNamespace('my-plugin', 'token');
    expect(ns).toBeNull();
  });

  it('returns null when helm returns invalid JSON', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, 'not-valid-json', '');
      return undefined as never;
    });

    const ns = await discoverReleaseNamespace('my-plugin', 'token');
    expect(ns).toBeNull();
  });

  it('throws when helm execution fails', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(new Error('helm not found'), '', 'command not found');
      return undefined as never;
    });

    await expect(discoverReleaseNamespace('my-plugin', 'token')).rejects.toThrow('Helm command failed');
  });
});

describe('helmListAllNamespaces', () => {
  it('returns parsed releases from all namespaces', async () => {
    const releases = [
      { name: 'plugin-alpha', namespace: 'plugin-alpha', status: 'deployed' },
      { name: 'plugin-beta', namespace: 'plugin-beta', status: 'deployed' },
    ];
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, JSON.stringify(releases), '');
      return undefined as never;
    });

    const result = await helmListAllNamespaces('user-token');

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).toContain('list');
    expect(args).toContain('--all-namespaces');
    expect(args).toContain('--output');
    expect(args).toContain('json');
    expect(result).toEqual(releases);
  });

  it('returns empty array when helm command fails', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(new Error('helm not found'), '', 'command not found');
      return undefined as never;
    });

    const result = await helmListAllNamespaces('user-token');
    expect(result).toEqual([]);
  });

  it('returns empty array when output is invalid JSON', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, 'not valid json', '');
      return undefined as never;
    });

    const result = await helmListAllNamespaces('user-token');
    expect(result).toEqual([]);
  });
});
