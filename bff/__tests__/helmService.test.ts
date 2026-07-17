import { helmInstall, helmUpgrade, helmUninstall } from '../src/services/helmService';
import { execFile } from 'child_process';
import { getK8sBaseUrl } from '../src/utils/k8sClient';

jest.mock('child_process');
jest.mock('../src/utils/k8sClient');

const mockExecFile = execFile as unknown as jest.MockedFunction<
  (cmd: string, args: string[], opts: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => void
>;
const mockGetK8sBaseUrl = getK8sBaseUrl as jest.MockedFunction<typeof getK8sBaseUrl>;

beforeEach(() => {
  jest.resetAllMocks();
  mockGetK8sBaseUrl.mockReturnValue('https://k8s.example.com:6443');
});

describe('helmInstall', () => {
  it('calls execFile with correct args including --kube-token', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '{"name":"test"}', '');
      return undefined as never;
    });

    await helmInstall('my-plugin', 'oci://quay.io/charts/plugin', 'my-ns', 'user-token');

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).toContain('install');
    expect(args).toContain('my-plugin');
    expect(args).toContain('oci://quay.io/charts/plugin');
    expect(args).toContain('--namespace');
    expect(args).toContain('my-ns');
    expect(args).toContain('--kube-token');
    expect(args).toContain('user-token');
    expect(args).toContain('--kube-apiserver');
    expect(args).toContain('https://k8s.example.com:6443');
    expect(args).toContain('--create-namespace');
    expect(args).toContain('--wait');
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
  it('calls execFile with upgrade command', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '{}', '');
      return undefined as never;
    });

    await helmUpgrade('my-plugin', 'chart', 'ns', 'token');

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).toContain('upgrade');
    expect(args).toContain('my-plugin');
  });
});

describe('helmUninstall', () => {
  it('calls execFile with uninstall command', async () => {
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
  });
});
