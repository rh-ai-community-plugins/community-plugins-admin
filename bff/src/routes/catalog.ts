import { Router, Request, Response } from 'express';
import { getRegistryPlugins } from '../services/charterClient';
import { getAllPluginMetadata, getPluginMetadata, clearPluginCache } from '../services/pluginMetadataClient';
import { CatalogPlugin, CatalogPluginInstall, CatalogPluginRbac, PluginMetadata, RegistryPlugin } from '../types/catalog';

const router = Router();

function buildCatalogPlugin(
  registry: RegistryPlugin,
  metadata: PluginMetadata | null,
): CatalogPlugin {
  const base: CatalogPlugin = {
    name: registry.name,
    repo: registry.repo,
    status: registry.status,
    maintenance: registry.maintenance,
    lastUpdated: registry.last_updated,
    metadataAvailable: metadata !== null,
  };

  if (!metadata) return base;

  let install: CatalogPluginInstall | undefined;
  if (metadata.install) {
    install = {
      method: metadata.install.method,
      helm: metadata.install.helm
        ? { chartPath: metadata.install.helm.chart_path, registry: metadata.install.helm.registry }
        : undefined,
      prerequisites: metadata.install.prerequisites,
      instructions: metadata.install.instructions,
    };
  }

  let rbac: CatalogPluginRbac | undefined;
  if (metadata.rbac) {
    rbac = {
      requiredRoles: metadata.rbac.required_roles,
      clusterRoles: metadata.rbac.cluster_roles,
    };
  }

  return {
    ...base,
    displayName: metadata.displayName,
    description: metadata.description,
    version: metadata.version,
    maintainer: metadata.maintainer,
    rhoaiCompatibility: metadata.rhoai_compatibility
      ? {
          minVersion: metadata.rhoai_compatibility.min_version,
          testedVersions: metadata.rhoai_compatibility.tested_versions,
        }
      : undefined,
    deploymentModel: metadata.deployment_model,
    image: metadata.image,
    bffImage: metadata.bff_image,
    install,
    rbac,
    support: metadata.support,
  };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    if (forceRefresh) {
      clearPluginCache();
    }

    const registryPlugins = await getRegistryPlugins(forceRefresh);
    const metadataMap = await getAllPluginMetadata(registryPlugins);

    const catalog: CatalogPlugin[] = registryPlugins.map((plugin) =>
      buildCatalogPlugin(plugin, metadataMap.get(plugin.name) ?? null),
    );

    const total = registryPlugins.length;
    const nullCount = registryPlugins.filter(
      (plugin) => (metadataMap.get(plugin.name) ?? null) === null,
    ).length;

    const warnings: string[] = [];
    if (total >= 2 && nullCount / total > 0.5) {
      const msg = `Metadata unavailable for ${nullCount} of ${total} plugins. This may indicate a temporary issue fetching plugin details.`;
      console.warn(msg);
      warnings.push(msg);
    }

    const response: { plugins: CatalogPlugin[]; warnings?: string[] } = { plugins: catalog };
    if (warnings.length > 0) {
      response.warnings = warnings;
    }

    res.json(response);
  } catch (err) {
    console.error('Failed to build catalog:', (err as Error).message);
    res.status(502).json({ error: 'Failed to fetch plugin catalog' });
  }
});

router.get('/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    const registryPlugins = await getRegistryPlugins();
    const registryEntry = registryPlugins.find((p) => p.name === name);

    if (!registryEntry) {
      res.status(404).json({ error: `Plugin '${name}' not found in registry` });
      return;
    }

    const metadata = await getPluginMetadata(registryEntry);
    const plugin = buildCatalogPlugin(registryEntry, metadata);

    res.json(plugin);
  } catch (err) {
    console.error(`Failed to fetch plugin detail for ${req.params.name}:`, (err as Error).message);
    res.status(502).json({ error: 'Failed to fetch plugin details' });
  }
});

export default router;
