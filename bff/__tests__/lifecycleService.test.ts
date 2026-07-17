import { sanitizeErrorMessage, upgradePlugin, removePlugin } from '../src/services/lifecycleService';

jest.mock('../src/services/helmService');
jest.mock('../src/services/dashboardConfigService');
jest.mock('../src/services/k8sApiClient');
jest.mock('../src/services/pluginMetadataClient');
jest.mock('../src/services/charterClient');

import {
  helmUpgrade,
  helmUninstall,
  discoverReleaseNamespace,
} from '../src/services/helmService';
import {
  removePluginFromConfig,
} from '../src/services/dashboardConfigService';
import { k8sRequest } from '../src/services/k8sApiClient';
import { getPluginMetadata } from '../src/services/pluginMetadataClient';
import { getRegistryPlugins } from '../src/services/charterClient';

const mockHelmUpgrade = helmUpgrade as jest.MockedFunction<typeof helmUpgrade>;
const mockHelmUninstall = helmUninstall as jest.MockedFunction<typeof helmUninstall>;
const mockDiscoverReleaseNamespace = discoverReleaseNamespace as jest.MockedFunction<typeof discoverReleaseNamespace>;
const mockRemovePluginFromConfig = removePluginFromConfig as jest.MockedFunction<typeof removePluginFromConfig>;
const mockK8sRequest = k8sRequest as jest.MockedFunction<typeof k8sRequest>;
const mockGetPluginMetadata = getPluginMetadata as jest.MockedFunction<typeof getPluginMetadata>;
const mockGetRegistryPlugins = getRegistryPlugins as jest.MockedFunction<typeof getRegistryPlugins>;

const FAKE_REGISTRY_ENTRY = {
  name: 'my-plugin',
  repo: 'https://github.com/org/my-plugin',
  status: 'stable' as const,
  maintenance: 'community' as const,
  last_updated: '2024-01-01',
};
const FAKE_METADATA = {
  name: 'my-plugin',
  version: '1.0.0',
  install: { helm: { registry: 'oci://quay.io/charts/my-plugin' } },
  remote: { spec: { scope: 'myPlugin', module: './extensions', remoteEntry: 'http://my-plugin.my-plugin.svc.cluster.local:8080/plugin-entry.js' } },
};

beforeEach(() => {
  jest.resetAllMocks();
  mockGetRegistryPlugins.mockResolvedValue([FAKE_REGISTRY_ENTRY]);
  mockGetPluginMetadata.mockResolvedValue(FAKE_METADATA as never);
  mockHelmUpgrade.mockResolvedValue('{}');
  mockHelmUninstall.mockResolvedValue('');
  mockRemovePluginFromConfig.mockResolvedValue(undefined);
  mockK8sRequest.mockResolvedValue({ status: 200, body: {} });
});

describe('sanitizeErrorMessage', () => {
  it('does not recurse infinitely and returns a string', () => {
    // This was the critical bug: the function used to call itself unconditionally,
    // producing RangeError: Maximum call stack size exceeded on every invocation.
    expect(() => sanitizeErrorMessage(new Error('boom'))).not.toThrow();
    expect(typeof sanitizeErrorMessage(new Error('boom'))).toBe('string');
  });

  it('extracts message from an Error instance', () => {
    const err = new Error('something went wrong');
    expect(sanitizeErrorMessage(err)).toBe('something went wrong');
  });

  it('converts non-Error values to string', () => {
    expect(sanitizeErrorMessage('plain string error')).toBe('plain string error');
    expect(sanitizeErrorMessage(42)).toBe('42');
    expect(sanitizeErrorMessage(null)).toBe('null');
    expect(sanitizeErrorMessage(undefined)).toBe('undefined');
    expect(sanitizeErrorMessage({ code: 500 })).toBe('[object Object]');
  });

  it('redacts --kube-token values', () => {
    const err = new Error('failed: --kube-token abc123def456 could not authenticate');
    expect(sanitizeErrorMessage(err)).toBe(
      'failed: --kube-token [REDACTED] could not authenticate',
    );
  });

  it('redacts service account identifiers', () => {
    const err = new Error('forbidden: system:serviceaccount:my-ns:my-sa cannot list pods');
    expect(sanitizeErrorMessage(err)).toBe(
      'forbidden: [service-account] cannot list pods',
    );
  });

  it('redacts bare IP:port API server URLs', () => {
    const err = new Error('connect ECONNREFUSED https://10.0.0.1:6443');
    expect(sanitizeErrorMessage(err)).toBe(
      'connect ECONNREFUSED [api-server]',
    );
  });

  it('applies all redactions in a single message', () => {
    const err = new Error(
      'helm install failed --kube-token secrettoken at https://192.168.1.100:6443 as system:serviceaccount:kube-system:default',
    );
    const result = sanitizeErrorMessage(err);
    expect(result).not.toContain('secrettoken');
    expect(result).not.toContain('192.168.1.100');
    expect(result).not.toContain('system:serviceaccount:kube-system:default');
    expect(result).toContain('[REDACTED]');
    expect(result).toContain('[api-server]');
    expect(result).toContain('[service-account]');
  });
});

describe('upgradePlugin namespace handling', () => {
  it('uses explicitly provided namespace for helm upgrade', async () => {
    mockDiscoverReleaseNamespace.mockResolvedValue('discovered-ns');

    const result = await upgradePlugin('my-plugin', 'token', 'custom-ns');

    expect(result.success).toBe(true);
    expect(mockDiscoverReleaseNamespace).not.toHaveBeenCalled();
    expect(mockHelmUpgrade).toHaveBeenCalledWith(
      'my-plugin',
      'oci://quay.io/charts/my-plugin',
      'custom-ns',
      'token',
      undefined,
    );
  });

  it('discovers namespace from helm release when none is provided', async () => {
    mockDiscoverReleaseNamespace.mockResolvedValue('installed-ns');

    const result = await upgradePlugin('my-plugin', 'token');

    expect(result.success).toBe(true);
    expect(mockDiscoverReleaseNamespace).toHaveBeenCalledWith('my-plugin', 'token');
    expect(mockHelmUpgrade).toHaveBeenCalledWith(
      'my-plugin',
      'oci://quay.io/charts/my-plugin',
      'installed-ns',
      'token',
      undefined,
    );
  });

  it('falls back to pluginName when discovery returns null', async () => {
    mockDiscoverReleaseNamespace.mockResolvedValue(null);

    const result = await upgradePlugin('my-plugin', 'token');

    expect(result.success).toBe(true);
    expect(mockHelmUpgrade).toHaveBeenCalledWith(
      'my-plugin',
      'oci://quay.io/charts/my-plugin',
      'my-plugin',
      'token',
      undefined,
    );
  });

  it('returns failure when helm upgrade fails', async () => {
    mockDiscoverReleaseNamespace.mockResolvedValue(null);
    mockHelmUpgrade.mockRejectedValue(new Error('helm upgrade error'));

    const result = await upgradePlugin('my-plugin', 'token');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Failed to upgrade plugin/);
    const failedStep = result.steps.find((s) => s.status === 'failed');
    expect(failedStep?.id).toBe('helm-upgrade');
  });
});

describe('removePlugin namespace handling', () => {
  it('uses explicitly provided namespace for helm uninstall', async () => {
    mockDiscoverReleaseNamespace.mockResolvedValue('discovered-ns');

    const result = await removePlugin('my-plugin', 'token', false, 'custom-ns');

    expect(result.success).toBe(true);
    expect(mockDiscoverReleaseNamespace).not.toHaveBeenCalled();
    expect(mockHelmUninstall).toHaveBeenCalledWith('my-plugin', 'custom-ns', 'token');
  });

  it('discovers namespace from helm release when none is provided', async () => {
    mockDiscoverReleaseNamespace.mockResolvedValue('installed-ns');

    const result = await removePlugin('my-plugin', 'token', false);

    expect(result.success).toBe(true);
    expect(mockDiscoverReleaseNamespace).toHaveBeenCalledWith('my-plugin', 'token');
    expect(mockHelmUninstall).toHaveBeenCalledWith('my-plugin', 'installed-ns', 'token');
  });

  it('falls back to pluginName when discovery returns null', async () => {
    mockDiscoverReleaseNamespace.mockResolvedValue(null);

    const result = await removePlugin('my-plugin', 'token', false);

    expect(result.success).toBe(true);
    expect(mockHelmUninstall).toHaveBeenCalledWith('my-plugin', 'my-plugin', 'token');
  });

  it('deletes the correct namespace when deleteNamespace=true with custom namespace', async () => {
    mockDiscoverReleaseNamespace.mockResolvedValue(null);

    const result = await removePlugin('my-plugin', 'token', true, 'custom-ns');

    expect(result.success).toBe(true);
    expect(mockHelmUninstall).toHaveBeenCalledWith('my-plugin', 'custom-ns', 'token');
    expect(mockK8sRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'DELETE',
        path: '/api/v1/namespaces/custom-ns',
        token: 'token',
      }),
    );
  });

  it('deletes the discovered namespace when deleteNamespace=true and namespace discovered', async () => {
    mockDiscoverReleaseNamespace.mockResolvedValue('installed-ns');

    const result = await removePlugin('my-plugin', 'token', true);

    expect(result.success).toBe(true);
    expect(mockK8sRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'DELETE',
        path: '/api/v1/namespaces/installed-ns',
      }),
    );
  });

  it('returns failure when helm uninstall fails', async () => {
    mockDiscoverReleaseNamespace.mockResolvedValue(null);
    mockHelmUninstall.mockRejectedValue(new Error('helm uninstall error'));

    const result = await removePlugin('my-plugin', 'token');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Failed to remove plugin/);
    const failedStep = result.steps.find((s) => s.status === 'failed');
    expect(failedStep?.id).toBe('helm-uninstall');
  });
});
