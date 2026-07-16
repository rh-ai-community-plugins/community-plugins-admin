import { Router, Request, Response } from 'express';
import { getRegistryPlugins } from '../services/charterClient';
import { getAllPluginMetadata, clearPluginCache } from '../services/pluginMetadataClient';
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

    res.json({ plugins: catalog });
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

    const metadataMap = await getAllPluginMetadata([registryEntry]);
    const metadata = metadataMap.get(name) ?? null;
    const plugin = buildCatalogPlugin(registryEntry, metadata);

    res.json(plugin);
  } catch (err) {
    console.error(`Failed to fetch plugin detail for ${req.params.name}:`, (err as Error).message);
    res.status(502).json({ error: 'Failed to fetch plugin details' });
  }
});

export default router;
