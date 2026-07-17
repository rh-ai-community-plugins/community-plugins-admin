import { Router, Request, Response } from 'express';
import {
  installPlugin,
  upgradePlugin,
  removePlugin,
  enablePlugin,
  disablePlugin,
} from '../services/lifecycleService';

const router = Router();

const PLUGIN_NAME_PATTERN = /^[a-z][a-z0-9-]{0,62}[a-z0-9]$/;

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

router.post('/:name/install', async (req: Request, res: Response) => {
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

  if (namespace !== undefined && typeof namespace !== 'string') {
    res.status(400).json({ error: 'namespace must be a string' });
    return;
  }

  try {
    const result = await installPlugin(req.params.name, token, namespace, values);
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    console.error(`Install failed for ${req.params.name}:`, err);
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Internal server error',
      steps: [],
    });
  }
});

router.post('/:name/upgrade', async (req: Request, res: Response) => {
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

  const { values } = req.body ?? {};

  try {
    const result = await upgradePlugin(req.params.name, token, values);
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    console.error(`Upgrade failed for ${req.params.name}:`, err);
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Internal server error',
      steps: [],
    });
  }
});

router.delete('/:name', async (req: Request, res: Response) => {
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

  try {
    const result = await removePlugin(req.params.name, token, deleteNamespace);
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    console.error(`Remove failed for ${req.params.name}:`, err);
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Internal server error',
      steps: [],
    });
  }
});

router.post('/:name/enable', async (req: Request, res: Response) => {
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

  try {
    const result = await enablePlugin(req.params.name, token);
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    console.error(`Enable failed for ${req.params.name}:`, err);
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Internal server error',
      steps: [],
    });
  }
});

router.post('/:name/disable', async (req: Request, res: Response) => {
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

  try {
    const result = await disablePlugin(req.params.name, token);
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    console.error(`Disable failed for ${req.params.name}:`, err);
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Internal server error',
      steps: [],
    });
  }
});

export default router;
