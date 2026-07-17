import { sanitizeErrorMessage } from '../src/services/lifecycleService';

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
