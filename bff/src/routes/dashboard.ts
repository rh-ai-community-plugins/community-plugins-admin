import { Router, Request, Response } from 'express';
import { k8sRequest } from '../services/k8sApiClient';

const router = Router();

const DASHBOARD_NAMESPACE = process.env.DASHBOARD_NAMESPACE || 'redhat-ods-applications';
const DASHBOARD_DEPLOYMENT = process.env.DASHBOARD_DEPLOYMENT || 'rhods-dashboard';

interface DeploymentCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

interface DeploymentStatus {
  replicas?: number;
  readyReplicas?: number;
  updatedReplicas?: number;
  availableReplicas?: number;
  observedGeneration?: number;
  conditions?: DeploymentCondition[];
}

interface DashboardDeployment {
  metadata?: { generation?: number };
  spec?: { replicas?: number };
  status?: DeploymentStatus;
}

export type RolloutStatus = 'progressing' | 'complete' | 'error';

function deriveRolloutStatus(deployment: DashboardDeployment): {
  rolloutStatus: RolloutStatus;
  replicas: number;
  readyReplicas: number;
  updatedReplicas: number;
  availableReplicas: number;
  message: string;
} {
  const desired = deployment.spec?.replicas ?? 0;
  const updated = deployment.status?.updatedReplicas ?? 0;
  const available = deployment.status?.availableReplicas ?? 0;
  const ready = deployment.status?.readyReplicas ?? 0;
  const total = deployment.status?.replicas ?? 0;
  const generation = deployment.metadata?.generation ?? 0;
  const observed = deployment.status?.observedGeneration ?? 0;
  const conditions = deployment.status?.conditions ?? [];

  const base = { replicas: desired, readyReplicas: ready, updatedReplicas: updated, availableReplicas: available };

  const progressCondition = conditions.find((c) => c.type === 'Progressing');
  if (progressCondition?.reason === 'ProgressDeadlineExceeded') {
    return {
      ...base,
      rolloutStatus: 'error',
      message: `Rollout stalled: ${progressCondition.message ?? 'progress deadline exceeded'}`,
    };
  }

  if (observed < generation) {
    return { ...base, rolloutStatus: 'progressing', message: `Dashboard pods are being updated (0/${desired})` };
  }

  const isComplete = updated >= desired && total <= desired && available >= desired;
  if (isComplete) {
    return { ...base, rolloutStatus: 'complete', message: `All ${desired} pod${desired !== 1 ? 's' : ''} ready` };
  }

  // Count completed swap cycles: a slot is "done" when the old pod is gone
  // and a new pod has taken its place. old pods = total - updated.
  const doneCount = Math.max(0, Math.min(desired, desired - total + updated));
  return {
    ...base,
    rolloutStatus: 'progressing',
    message: `Dashboard pods are being updated (${doneCount}/${desired})`,
  };
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

router.get('/status', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authorization token required' });
    return;
  }

  try {
    const path = `/apis/apps/v1/namespaces/${DASHBOARD_NAMESPACE}/deployments/${DASHBOARD_DEPLOYMENT}`;
    const result = await k8sRequest<DashboardDeployment>({ method: 'GET', path, token });

    if (result.status !== 200) {
      res.status(result.status).json({ error: `Failed to read dashboard deployment: HTTP ${result.status}` });
      return;
    }

    res.json(deriveRolloutStatus(result.body));
  } catch (err) {
    console.error('Failed to get dashboard status:', (err as Error).message);
    res.status(500).json({ error: 'Failed to get dashboard status' });
  }
});

export default router;
export { deriveRolloutStatus };
