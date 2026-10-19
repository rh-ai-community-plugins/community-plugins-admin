import { scopeToKebab } from '~/app/hooks/useInstalledPluginNames';
import { CatalogPlugin } from '~/app/types/catalog';

/**
 * Kebab-cased Module Federation name a plugin is registered under in
 * MODULE_FEDERATION_CONFIG. Prefer the declared MF scope (remote.spec.name,
 * camelCase — e.g. gpuBooking) over the registry name: the GitHub repo and
 * charter entry can be renamed (gpu-booking → gpu-booking-plugin) while the
 * deployed federation config keeps the original scope.
 */
export const mfKebab = (p: Pick<CatalogPlugin, 'name' | 'remote'>): string =>
  scopeToKebab(p.remote?.spec?.name ?? p.remote?.spec?.scope ?? p.name);

/**
 * A plugin counts as installed when its registry name OR its MF-scope name is
 * present in the installed set (keyed by kebab-cased MF names from
 * MODULE_FEDERATION_CONFIG). "Disabled" keeps its meaning: a Helm release
 * exists but the plugin is not registered in the dashboard config.
 */
export function resolveInstallState(
  p: Pick<CatalogPlugin, 'name' | 'remote'>,
  { installedNames, helmInstalledNames }: { installedNames: Set<string>; helmInstalledNames: Set<string> },
): { installed: boolean; disabled: boolean } {
  const installed = installedNames.has(p.name) || installedNames.has(mfKebab(p));
  const disabled = helmInstalledNames.has(p.name) && !installed;
  return { installed, disabled };
}
