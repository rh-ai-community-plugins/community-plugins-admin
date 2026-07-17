# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `community-plugins-admin`, a community plugin for the **Red Hat OpenShift AI (RHOAI) Dashboard** that lets administrators discover, install, upgrade, remove, enable, and disable community plugins from the dashboard UI. It is intended to be the first plugin installed on a dashboard, bootstrapping the community plugin ecosystem. Non-admin users can browse the catalog and see installed plugins but cannot modify them. The plugin reads the community plugin registry from the [rh-ai-community-plugins/charter](https://github.com/rh-ai-community-plugins/charter) repo (`plugins.yaml`) and aggregates metadata from each plugin's own `plugin.yaml`. It uses Webpack 5 Module Federation to expose remote modules that the RHOAI dashboard host application loads at runtime.

## Branching Strategy

- **`main`** is the release branch. It contains only released, production-ready code. Do not push directly to `main`.
- **`dev`** is the development branch. All day-to-day work happens here.
- **Feature branches** are created from `dev` (e.g., `feat/catalog-page`, `fix/cache-ttl`). When complete, they are merged back into `dev` via PR.
- **Releases**: when `dev` is ready to release, a PR is opened from `dev` to `main` after final testing and preparation.

When creating PRs, always target `dev` unless it is a release PR to `main`.

## Build & Development Commands

```bash
npm run start:dev     # Dev server on port 9500 with HMR
npm run build         # Production build to dist/
npm test              # Run all tests (Jest + jsdom)
npm run test:watch    # Watch mode
npm run test:coverage # Tests with coverage report
npm run lint          # ESLint on src/ + markdownlint on **/*.md
```

To run a single test file:

```bash
npx jest src/app/hooks/useCurrentUser.test.ts
```

### BFF Service Commands

```bash
cd bff
K8S_API_BASE=$(oc whoami --show-server) npm run start:dev  # Dev server on port 3000 (K8S_API_BASE required for local dev)
npm run build         # Compile TypeScript to dist/
npm start             # Run compiled server (in-cluster, K8S_API_BASE not needed)
npm test              # Run BFF tests (Jest + node)
npm run lint          # ESLint on bff/src/
```

## Architecture

### Module Federation Plugin System

The plugin exposes two remote modules to the RHOAI dashboard host via Webpack Module Federation (configured inline in `config/webpack.common.js`):

- **`./extensions`** (`src/rhoai/extensions.ts`) — Defines six extension points:
  - `app.area` — registers the `community-plugins-admin` feature area
  - `app.navigation/section` (x2) — `community-plugins` shared parent section (with `CommunityNavIcon`) and `community-plugins-admin` plugin subsection (with `CommunityPluginsAdminNavIcon`)
  - `app.navigation/href` (x2) — "Catalog" and "Installed" nav items under the `community-plugins-admin` section
  - `app.route` — mounts the App component with wildcard routing at `/community-plugins-admin/*`
- **`./Icon`** (`src/app/components/CommunityPluginsAdminNavIcon.tsx`) — SVG icon for the plugin's nav subsection. A separate `CommunityNavIcon.tsx` provides the icon for the shared `community-plugins` parent section.

Shared singletons (react, react-dom, react-router-dom, @patternfly/react-core, @openshift/dynamic-plugin-sdk) are provided by the host and not bundled into the plugin.

### Pages

The plugin has two pages, routed under `/community-plugins-admin/*`:

- **Catalog page** (`src/app/pages/CatalogPage.tsx`) — Browse available community plugins from the charter registry. Displays a PatternFly card grid with search, filtering (status, maintenance tier, install state), and version comparison for installed plugins.
- **Installed page** (`src/app/pages/InstalledPage.tsx`) — View and manage installed community plugins. Shows a table with health status, version, maintenance tier, and admin actions (upgrade, disable, remove).

A `PluginDetailModal` (`src/app/components/PluginDetailModal.tsx`) opens from either page to show full plugin metadata and lifecycle action buttons (install, upgrade, remove, enable, disable). The modal preserves parent page state (filters, scroll, search).

### Components

- **`CommunityBanner.tsx`** — [SHARED] Orange banner identifying community plugin pages. Must not be removed.
- **`CommunityPluginsAdminNavIcon.tsx`** — SVG icon for the plugin's sidebar nav entry.
- **`PluginDetailModal.tsx`** — Full plugin detail overlay with metadata sections, action buttons (admin-only), and lifecycle integration.
- **`ConfirmRemoveModal.tsx`** — Confirmation dialog requiring the user to type the plugin name before removal.
- **`LifecycleProgressModal.tsx`** — Step-by-step progress display for install/upgrade/remove operations using PatternFly `ProgressStepper`.

### Custom Hooks

Twelve hooks in `src/app/hooks/` provide data fetching, state management, and API integration:

- `useCurrentUser` — Fetches authenticated user info from `/api/status`.
- `useProjects` — Fetches accessible projects from the OpenShift projects API.
- `useFavoriteProjects` — Manages localStorage-backed project favorites.
- `useLastSelectedProject` — Persists the last-selected project in localStorage.
- `useAccessReview` — Checks RBAC permissions via SelfSubjectAccessReview.
- `useCatalog` — Fetches the merged plugin catalog from the BFF (`GET /api/catalog`). Returns plugin list with loading/error/refetch states.
- `useInstalledPluginNames` — Reads `MODULE_FEDERATION_CONFIG` from the dashboard to determine which plugins are currently enabled.
- `useHelmReleasedPlugins` — Lists Helm releases via the BFF (`GET /api/plugins`) to find all deployed plugins, including disabled ones. Provides version mapping.
- `useInstalledPlugins` — Merges installed plugin names, Helm releases, and catalog metadata to produce a unified installed plugins list with health status.
- `usePluginDetail` — Fetches full metadata for a single plugin from the BFF (`GET /api/catalog/:name`) and resolves installed state.
- `usePluginLifecycle` — Provides install/upgrade/remove/enable/disable operations that call BFF lifecycle endpoints. Tracks operation progress, loading, and result state.

### Frontend Types

- `src/app/types/catalog.ts` — `CatalogPlugin` type for the merged catalog response from the BFF.
- `src/app/types/installed.ts` — `InstalledPlugin` and `PluginHealthStatus` types for the installed plugins view.
- `src/app/types/lifecycle.ts` — `LifecycleResult`, `LifecycleStep`, and related types for plugin lifecycle operations.

### Utilities

- `src/app/utils/maintenance.ts` — Helper functions for label colors and display text for maintenance tiers, status badges, and deployment model labels.

### BFF Service

The `bff/` directory contains a standalone Express.js + TypeScript backend service that implements the BFF pattern. The dashboard proxies requests from `/community-plugins-admin/api/*` to this service, forwarding the user's Bearer token. See `docs/architecture/BFF_PATTERN.md` for details.

The BFF app is defined in `bff/src/app.ts` (Express middleware and routes) and started in `bff/src/server.ts` (listen + K8s config logging). This split allows tests to import the app without starting a persistent server.

**Endpoints:**

- `GET /api/health` — Liveness probe.
- `GET /api/catalog` — Merged list of all community plugins (registry entry + resolved metadata). Supports `?refresh=true` to force cache invalidation.
- `GET /api/catalog/:name` — Full metadata for a single plugin.
- `GET /api/plugins` — List all Helm-deployed plugin releases across namespaces.
- `POST /api/plugins/:name/install` — Install a plugin via Helm. Accepts `namespace` and `values` in the request body.
- `POST /api/plugins/:name/upgrade` — Upgrade a plugin to the latest chart version.
- `DELETE /api/plugins/:name` — Remove a plugin (Helm uninstall + config cleanup). Supports `?deleteNamespace=true`.
- `POST /api/plugins/:name/enable` — Add a plugin's Module Federation entry to `MODULE_FEDERATION_CONFIG`.
- `POST /api/plugins/:name/disable` — Remove a plugin's entry from `MODULE_FEDERATION_CONFIG` (plugin stays deployed but hidden).

All lifecycle endpoints require a Bearer token (forwarded from the dashboard) and validate the plugin name against `^[a-z][a-z0-9-]{0,62}[a-z0-9]$`.

**Services:**

- `bff/src/services/charterClient.ts` — Fetches `plugins.yaml` from the charter registry on GitHub, parses YAML, caches in-memory with configurable TTL (default 5 min, `CHARTER_CACHE_TTL_MS` env var). Serves stale cache on fetch failure.
- `bff/src/services/pluginMetadataClient.ts` — Fetches `plugin.yaml` from each plugin's GitHub repo, parses and validates, per-plugin cache with TTL (`PLUGIN_CACHE_TTL_MS`), concurrent fetches with configurable limit (`PLUGIN_FETCH_CONCURRENCY`, default 5). Returns null for plugins with missing/invalid metadata.
- `bff/src/services/dashboardConfigService.ts` — Reads and modifies `MODULE_FEDERATION_CONFIG` on the `rhods-dashboard` deployment. Handles JSON Patch operations with optimistic concurrency control (409 conflict retry).
- `bff/src/services/helmService.ts` — Executes Helm CLI operations (install, upgrade, uninstall, list) using temporary kubeconfig files. Validates Helm values and discovers plugin namespaces.
- `bff/src/services/lifecycleService.ts` — Orchestrates plugin lifecycle operations (install, upgrade, remove, enable, disable) by coordinating chart resolution, Helm execution, and config updates.
- `bff/src/services/k8sApiClient.ts` — Low-level K8s API HTTP client with CA cert caching, TLS configuration, and request timeout handling.
- `bff/src/utils/httpClient.ts` — Shared HTTP fetch utility with redirect following, used by charter and metadata clients.
- `bff/src/utils/k8sClient.ts` — K8s API base URL resolution (in-cluster vs local dev).

**Types:**

- `bff/src/types/catalog.ts` — `RegistryPlugin` (upstream YAML schema), `PluginMetadata` (plugin.yaml schema), and `CatalogPlugin` (camelCase API response shape).
- `bff/src/types/lifecycle.ts` — `InstallRequest`, `UpgradeRequest`, and related types for lifecycle operations.

### Entry Point Chain

`src/index.ts` → dynamic import → `src/bootstrap.tsx` (React 18 root render). The dynamic import is required for Module Federation to resolve shared dependencies before the app renders.

### Plugin Registration

`plugin.yaml` at the repo root is a unified flat manifest that serves both as the Module Federation runtime config (consumed by the RHOAI dashboard) and the community plugin catalog metadata (consumed by the charter registry). It declares plugin identity, maintainer, RHOAI version compatibility, deployment model, container image, install method (automatic/assisted/manual with Helm registry and prerequisites), Module Federation remote entry and routes, RBAC requirements, and support links.

### Webpack Configs

- `config/webpack.common.js` — Shared config: entry point, loaders, Module Federation, path alias `~` → `./src`
- `config/webpack.dev.js` — Dev server on port 9500, proxies `/community-plugins-admin/api` to BFF at `localhost:3000` and `/community-plugins-admin` to dashboard at `localhost:8443`
- `config/webpack.prod.js` — Output to `dist/`, CSS extraction, vendor chunk splitting

### Test Setup

Jest with `ts-jest` preset and `jsdom` environment (`jest.config.js`). `jest.setup.tsx` mocks `react-router-dom` (useNavigate, useParams, useLocation, Outlet, Routes, Route, Navigate) and polyfills TextEncoder/TextDecoder. CSS modules are proxied to return property names as class names (`jest.style-mock.js`).

### Scripts

- `scripts/build-push.sh` — Builds and pushes container images (frontend, BFF, or both) to Quay.io. Auto-computes the next version from git tags if not provided.
- `scripts/scan-image.sh` — Builds container images locally and scans them for vulnerabilities using Trivy.
- `scripts/sync-chart-version.js` — Syncs the version from root `package.json` into `chart/Chart.yaml`, `bff/package.json`, and `plugin.yaml` (both `version` and `image.tag`). Runs automatically via npm's `version` lifecycle hook.

### Deployment

- **Frontend container**: Multi-stage build in `Containerfile` — UBI9 Node 22 builder → UBI9 Nginx 1.24 serving `dist/` on port 8080 as UID 1001. Nginx adds CORS header on `remoteEntry.js`.
- **BFF container**: Multi-stage build in `bff/Containerfile` — UBI9 Node 22 builder → UBI9 Node 22 runtime on port 3000 as UID 1001. Includes Helm binary for lifecycle operations.
- **Helm chart**: `chart/` deploys to Kubernetes with:
  - Frontend: Deployment + Service (Nginx on port 8080)
  - BFF: Deployment + Service (Node.js on port 3000) + ServiceAccount + ClusterRole + ClusterRoleBinding
  - The BFF ServiceAccount has cluster-level permissions for managing plugin deployments, namespaces, and the dashboard's `MODULE_FEDERATION_CONFIG`.

### CI/CD Workflows

- `.github/workflows/ci.yml` — Runs tests and lint for both frontend and BFF on push/PR to main.
- `.github/workflows/build-push.yml` — Builds and pushes both container images to Quay.io. Manually triggered via `workflow_dispatch` with a version input.

## Documentation

Project documentation lives under `docs/` in semantic subfolders:

```text
docs/architecture/   — Plugin system internals, extension contract, BFF pattern
docs/development/    — Local dev setup, project layout, customization, build & push
docs/deployment/     — OpenShift deployment with Helm and dashboard registration
docs/project/        — Project plan and phase tracking
```

## Key Conventions

- Path alias: `~` maps to `./src` (webpack) and `@` maps to `./src` (jest). Use `~` in source code imports.
- UI components use **PatternFly 6** (`@patternfly/react-core`, `@patternfly/react-icons`).
- TypeScript strict mode is enabled. Target is ES2020 with ESNext modules and `react-jsx` transform.
- No standalone ESLint config file — uses `@typescript-eslint` defaults via dev dependencies.
