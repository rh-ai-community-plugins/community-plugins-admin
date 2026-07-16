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

- **Catalog page** (`src/app/pages/CatalogPage.tsx`) — Browse available community plugins from the charter registry.
- **Installed page** (`src/app/pages/InstalledPage.tsx`) — View and manage installed community plugins.

A `PluginDetailModal` (`src/app/components/PluginDetailModal.tsx`) is a placeholder shell for the detail overlay that will be built out in Phase 5. It is not yet wired into either page.

### Custom Hooks

Five hooks in `src/app/hooks/` provide data fetching and API integration:

- `useCurrentUser` — Fetches authenticated user info from `/api/status`.
- `useProjects` — Fetches accessible projects from the OpenShift projects API.
- `useFavoriteProjects` — Manages localStorage-backed project favorites.
- `useLastSelectedProject` — Persists the last-selected project in localStorage.
- `useAccessReview` — Checks RBAC permissions via SelfSubjectAccessReview.

### BFF Service

The `bff/` directory contains a standalone Express.js + TypeScript backend service that implements the BFF pattern. The dashboard proxies requests from `/community-plugins-admin/api/*` to this service, forwarding the user's Bearer token. See `docs/architecture/BFF_PATTERN.md` for details.

The BFF app is defined in `bff/src/app.ts` (Express middleware and routes) and started in `bff/src/server.ts` (listen + K8s config logging). This split allows tests to import the app without starting a persistent server.

**Endpoints:**

- `GET /api/health` — liveness probe
- `GET /api/catalog` — merged list of all community plugins (registry entry + resolved metadata). Supports `?refresh=true` to force cache invalidation.
- `GET /api/catalog/:name` — full metadata for a single plugin

**Services:**

- `bff/src/services/charterClient.ts` — fetches `plugins.yaml` from the charter registry on GitHub, parses YAML, caches in-memory with configurable TTL (default 5 min, `CHARTER_CACHE_TTL_MS` env var). Serves stale cache on fetch failure.
- `bff/src/services/pluginMetadataClient.ts` — fetches `plugin.yaml` from each plugin's GitHub repo, parses and validates, per-plugin cache with TTL (`PLUGIN_CACHE_TTL_MS`), concurrent fetches with configurable limit (`PLUGIN_FETCH_CONCURRENCY`, default 5). Returns null for plugins with missing/invalid metadata.
- `bff/src/utils/httpClient.ts` — shared HTTP fetch utility with redirect following, used by both service clients.

**Types:** `bff/src/types/catalog.ts` defines `RegistryPlugin` (upstream YAML schema), `PluginMetadata` (plugin.yaml schema), and `CatalogPlugin` (camelCase API response shape).

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
- **BFF container**: Multi-stage build in `bff/Containerfile` — UBI9 Node 22 builder → UBI9 Node 22 runtime on port 3000 as UID 1001.
- **Helm chart**: `chart/` deploys to Kubernetes with Deployment + Service for both frontend and BFF. Frontend defaults to `quay.io/OWNER/community-plugins-admin:latest`, BFF to `quay.io/OWNER/community-plugins-admin-bff:latest`.

### CI/CD Workflows

- `.github/workflows/ci.yml` — Runs tests and lint for both frontend and BFF on push/PR to main.
- `.github/workflows/build-push.yml` — Builds and pushes both container images to Quay.io. Manually triggered via `workflow_dispatch` with a version input.

## Documentation

Project documentation lives under `docs/` in semantic subfolders:

```text
docs/architecture/   — Plugin system internals and extension contract
docs/development/    — Local dev setup and dashboard API reference
docs/deployment/     — OpenShift deployment with Helm and dashboard registration
```

## Key Conventions

- Path alias: `~` maps to `./src` (webpack) and `@` maps to `./src` (jest). Use `~` in source code imports.
- UI components use **PatternFly 6** (`@patternfly/react-core`, `@patternfly/react-icons`).
- TypeScript strict mode is enabled. Target is ES2020 with ESNext modules and `react-jsx` transform.
- No standalone ESLint config file — uses `@typescript-eslint` defaults via dev dependencies.
