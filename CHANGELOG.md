# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

### Added

- **Catalog page** — browse available community plugins with card grid, search, filtering by status/maintenance/install state, and version comparison for installed plugins.
- **Installed page** — view and manage installed plugins with PatternFly table showing health status, version, maintenance tier, and admin actions (upgrade, disable, remove).
- **Plugin detail modal** — full plugin metadata overlay with description, compatibility info, deployment model, images, support links, and lifecycle action buttons (admin-only).
- **Confirm remove modal** — confirmation dialog requiring the user to re-type the plugin name before removal.
- **Lifecycle progress modal** — step-by-step progress display for install/upgrade/remove operations using PatternFly ProgressStepper.
- **BFF catalog endpoints** — `GET /api/catalog` and `GET /api/catalog/:name` aggregate plugin metadata from the charter registry and individual plugin repos with in-memory caching.
- **BFF lifecycle endpoints** — `POST /api/plugins/:name/install`, `POST /api/plugins/:name/upgrade`, `DELETE /api/plugins/:name`, `POST /api/plugins/:name/enable`, `POST /api/plugins/:name/disable` for plugin lifecycle management via Helm.
- **Charter registry client** — fetches and caches `plugins.yaml` from the charter registry with configurable TTL and stale-cache fallback.
- **Plugin metadata client** — fetches `plugin.yaml` from each plugin repo with per-plugin caching and concurrency control.
- **Dashboard config service** — reads and modifies `MODULE_FEDERATION_CONFIG` on the dashboard deployment with optimistic concurrency control (409 retry).
- **Helm service** — executes Helm CLI operations using temporary kubeconfig files with value validation and namespace discovery.
- **Lifecycle service** — orchestrates install/upgrade/remove/enable/disable by coordinating chart resolution, Helm execution, and config updates.
- **Dashboard restart banner** — monitors dashboard pod rollout after lifecycle operations (install, upgrade, remove, enable, disable) and displays real-time status with auto-dismiss on completion.
- **BFF dashboard status endpoint** — `GET /api/dashboard/status` reads the dashboard deployment rollout state and derives progress (`progressing`, `complete`, `error`).
- **BFF config endpoint** — `GET /api/config` exposes dashboard namespace and deployment name configuration.
- **Frontend hooks** — `useCatalog`, `useInstalledPlugins`, `useInstalledPluginNames`, `useHelmReleasedPlugins`, `usePluginDetail`, `usePluginLifecycle`, `useDashboardRollout` for data fetching, lifecycle operations, and dashboard status polling.
- **Helm chart RBAC** — ClusterRole and ClusterRoleBinding for the BFF ServiceAccount with permissions for plugin lifecycle management, including RBAC safety guard preventing orphaned bindings.
- **CI/CD** — GitHub Actions workflows for tests, linting (frontend + BFF + Helm chart), and container image builds.
- **Error boundary** — catches rendering errors with meaningful fallback UI.
- **404 route** — handles unmatched paths with a helpful redirect.
- **Accessibility** — keyboard navigation and screen reader support across pages.
