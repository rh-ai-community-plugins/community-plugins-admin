jest.mock('fs');

describe('getCaCert', () => {
  beforeEach(() => {
    // Reset the module registry so the module-level cachedCaCert sentinel
    // is re-initialised to undefined for each test.
    jest.resetModules();
  });

  it('returns the CA cert Buffer when the cert file exists', () => {
    const mockFs = require('fs') as jest.Mocked<typeof import('fs')>;
    const mockCert = Buffer.from('mock-ca-cert');
    (mockFs.readFileSync as jest.Mock).mockReturnValue(mockCert);

    const { getCaCert } = require('../src/services/k8sApiClient') as typeof import('../src/services/k8sApiClient');

    expect(getCaCert()).toBe(mockCert);
    expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt',
    );
  });

  it('caches the positive result — readFileSync is not called again after the first successful read', () => {
    const mockFs = require('fs') as jest.Mocked<typeof import('fs')>;
    const mockCert = Buffer.from('mock-ca-cert');
    (mockFs.readFileSync as jest.Mock).mockReturnValue(mockCert);

    const { getCaCert } = require('../src/services/k8sApiClient') as typeof import('../src/services/k8sApiClient');

    const first = getCaCert();
    const second = getCaCert();
    const third = getCaCert();

    expect(first).toBe(mockCert);
    expect(second).toBe(mockCert);
    expect(third).toBe(mockCert);
    expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when the cert file does not exist', () => {
    const mockFs = require('fs') as jest.Mocked<typeof import('fs')>;
    (mockFs.readFileSync as jest.Mock).mockImplementation(() => {
      throw Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
    });

    const { getCaCert } = require('../src/services/k8sApiClient') as typeof import('../src/services/k8sApiClient');

    expect(getCaCert()).toBeUndefined();
  });

  it('caches the negative result — readFileSync is not called again after a missing cert', () => {
    const mockFs = require('fs') as jest.Mocked<typeof import('fs')>;
    (mockFs.readFileSync as jest.Mock).mockImplementation(() => {
      throw Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
    });

    const { getCaCert } = require('../src/services/k8sApiClient') as typeof import('../src/services/k8sApiClient');

    expect(getCaCert()).toBeUndefined();
    expect(getCaCert()).toBeUndefined();
    expect(getCaCert()).toBeUndefined();

    // The sentinel is now null (confirmed missing), so readFileSync must not fire again.
    expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
  });
});
