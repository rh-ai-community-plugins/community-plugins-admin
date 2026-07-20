import { getK8sBaseUrl } from '../src/utils/k8sClient';

describe('getK8sBaseUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.K8S_API_BASE;
    delete process.env.KUBERNETES_SERVICE_HOST;
    delete process.env.KUBERNETES_SERVICE_PORT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns K8S_API_BASE when set', () => {
    process.env.K8S_API_BASE = 'https://my-cluster:6443';
    expect(getK8sBaseUrl()).toBe('https://my-cluster:6443');
  });

  it('constructs URL from KUBERNETES_SERVICE_HOST and PORT', () => {
    process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
    process.env.KUBERNETES_SERVICE_PORT = '443';
    expect(getK8sBaseUrl()).toBe('https://10.0.0.1:443');
  });

  it('throws when no env vars are set', () => {
    expect(() => getK8sBaseUrl()).toThrow('K8s API not configured');
  });
});
