export function getK8sBaseUrl(): string {
  if (process.env.K8S_API_BASE) {
    return process.env.K8S_API_BASE;
  }
  const host = process.env.KUBERNETES_SERVICE_HOST;
  const port = process.env.KUBERNETES_SERVICE_PORT;
  if (host && port) {
    return `https://${host}:${port}`;
  }
  throw new Error(
    'K8s API not configured: set K8S_API_BASE or run in-cluster',
  );
}
