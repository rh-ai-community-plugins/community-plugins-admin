import { Router, Request, Response } from 'express';
import {
  installPlugin,
  upgradePlugin,
  removePlugin,
  enablePlugin,
  disablePlugin,
} from '../services/lifecycleService';
import { validateHelmValues, helmListAllNamespaces } from '../services/helmService';
import { LifecycleResponse, LifecycleProgressCallback } from '../types/lifecycle';

const router = Router();

const PLUGIN_NAME_PATTERN = /^[a-z][a-z0-9-]{0,62}[a-z0-9]$/;

router.get('/', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authorization token required' });
    return;
  }

  try {
    const releases = await helmListAllNamespaces(token);
    res.json({ releases });
  } catch (err) {
    console.error('Failed to list Helm releases:', (err as Error).message);
    res.status(500).json({ error: 'Failed to list Helm releases' });
  }
});

const K8S_NAMESPACE_PATTERN = /^[a-z][a-z0-9-]{0,62}[a-z0-9]$/;

const PROTECTED_NAMESPACES = new Set([
  'default', 'kube-system', 'kube-public', 'kube-node-lease',
  'openshift', 'openshift-operators', 'openshift-config',
  'openshift-monitoring', 'openshift-infra', 'openshift-apiserver',
  'redhat-ods-applications', 'redhat-ods-monitoring', 'redhat-ods-operator',
  'opendatahub',
]);

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function validatePluginName(name: string): string | null {
  if (!PLUGIN_NAME_PATTERN.test(name)) {
    return 'Invalid plugin name: must be lowercase alphanumeric with hyphens, 2-64 characters';
  }
  return null;
}

function sendSSE(
  req: Request,
  res: Response,
  serviceFn: (onProgress?: LifecycleProgressCallback) => Promise<LifecycleResponse>,
): void {
  const wantsSSE = req.headers.accept?.includes('text/event-stream');

  if (!wantsSSE) {
    serviceFn().then((result) => {
      res.status(result.success ? 200 : 500).json(result);
    }).catch(() => {
      res.status(500).json({ success: false, message: 'Operation failed', steps: [] });
    });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15_000);

  const onProgress: LifecycleProgressCallback = (steps) => {
    const data = JSON.stringify({ steps: steps.map(s => ({ ...s })) });
    res.write(`event: progress\ndata: ${data}\n\n`);
  };

  serviceFn(onProgress)
    .then((result) => {
      clearInterval(heartbeat);
      res.write(`event: complete\ndata: ${JSON.stringify(result)}\n\n`);
      res.end();
    })
    .catch(() => {
      clearInterval(heartbeat);
      const fallback: LifecycleResponse = {
        success: false,
        message: 'Operation failed',
        steps: [],
      };
      res.write(`event: complete\ndata: ${JSON.stringify(fallback)}\n\n`);
      res.end();
    });
}

router.post('/:name/install', (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authorization token required' });
    return;
  }

  const nameError = validatePluginName(req.params.name);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }

  const { namespace, values } = req.body ?? {};

  if (namespace !== undefined) {
    if (typeof namespace !== 'string' || !K8S_NAMESPACE_PATTERN.test(namespace)) {
      res.status(400).json({ error: 'Invalid namespace: must be lowercase alphanumeric with hyphens, 2-64 characters' });
      return;
    }
    if (PROTECTED_NAMESPACES.has(namespace)) {
      res.status(400).json({ error: `Cannot install into protected namespace "${namespace}"` });
      return;
    }
  }

  if (values !== undefined) {
    try {
      validateHelmValues(values);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid values' });
      return;
    }
  }

  sendSSE(req, res, (onProgress) =>
    installPlugin(req.params.name, token, namespace, values, onProgress),
  );
});

router.post('/:name/upgrade', (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authorization token required' });
    return;
  }

  const nameError = validatePluginName(req.params.name);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }

  const { namespace, values } = req.body ?? {};

  if (namespace !== undefined) {
    if (typeof namespace !== 'string' || !K8S_NAMESPACE_PATTERN.test(namespace)) {
      res.status(400).json({ error: 'Invalid namespace: must be lowercase alphanumeric with hyphens, 2-64 characters' });
      return;
    }
    if (PROTECTED_NAMESPACES.has(namespace)) {
      res.status(400).json({ error: `Cannot upgrade in protected namespace "${namespace}"` });
      return;
    }
  }

  if (values !== undefined) {
    try {
      validateHelmValues(values);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid values' });
      return;
    }
  }

  sendSSE(req, res, (onProgress) =>
    upgradePlugin(req.params.name, token, namespace, values, onProgress),
  );
});

router.delete('/:name', (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authorization token required' });
    return;
  }

  const nameError = validatePluginName(req.params.name);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }

  const deleteNamespace = req.query.deleteNamespace === 'true';
  const namespace = typeof req.query.namespace === 'string' ? req.query.namespace : undefined;

  if (namespace !== undefined) {
    if (!K8S_NAMESPACE_PATTERN.test(namespace)) {
      res.status(400).json({ error: 'Invalid namespace: must be lowercase alphanumeric with hyphens, 2-64 characters' });
      return;
    }
    if (PROTECTED_NAMESPACES.has(namespace)) {
      res.status(400).json({ error: `Cannot remove from protected namespace "${namespace}"` });
      return;
    }
  }

  sendSSE(req, res, (onProgress) =>
    removePlugin(req.params.name, token, deleteNamespace, namespace, onProgress),
  );
});

router.post('/:name/enable', (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authorization token required' });
    return;
  }

  const nameError = validatePluginName(req.params.name);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }

  sendSSE(req, res, (onProgress) =>
    enablePlugin(req.params.name, token, onProgress),
  );
});

router.post('/:name/disable', (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authorization token required' });
    return;
  }

  const nameError = validatePluginName(req.params.name);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }

  sendSSE(req, res, (onProgress) =>
    disablePlugin(req.params.name, token, onProgress),
  );
});

export default router;
