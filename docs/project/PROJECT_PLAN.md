# Community Plugins Admin — Project Plan

## Overview

Build a community plugin for the RHOAI Dashboard that lets administrators discover, install, upgrade, remove, enable, and disable community plugins — directly from the dashboard UI. Non-admin users can browse the catalog and view installed plugins but cannot modify them.

Community Plugins Admin is intended to be the **first plugin** installed on a dashboard. Once in place, it automates plugin lifecycle management so that admins no longer need to manually edit `MODULE_FEDERATION_CONFIG` or run Helm commands to manage plugins.

### Plugin Registry

The source of available plugins is the [charter registry](https://github.com/rh-ai-community-plugins/charter) (`plugins.yaml` on the `dev` branch). Each entry in the registry points to a plugin repo:

```yaml
plugins:
  - name: brewet
    repo: https://github.com/rh-ai-community-plugins/brewet
    status: experimental
    maintenance: red-hat
    last_updated: 2026-06-24
```

Detailed metadata (description, version, compatibility, deployment model, images, install method) comes from each plugin's own `plugin.yaml` at the repo root — the same format this plugin uses for its own manifest.

## Architecture

### High-Level Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│  Cluster (Helm chart)                                           │
│  ┌────────────────────┐   ┌──────────────────────────────────┐  │
│  │  Plugin Frontend   │   │  BFF (Express)                   │  │
│  │  (Nginx, port 8080)│   │  (port 3000)                     │  │
│  │  Module Federation │   │  Aggregates & caches plugin      │  │
│  │  remoteEntry.js    │   │  metadata from charter registry  │  │
│  │                    │   │  and individual plugin repos      │  │
│  └────────────────────┘   └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Sources

| Source | What It Provides | Access Method |
|---|---|---|
| **Charter registry** (`plugins.yaml`) | List of registered plugins with repo URLs, status, maintenance tier | BFF fetches from GitHub raw content |
| **Plugin repos** (`plugin.yaml` per repo) | Version, compatibility, images, install method, RBAC requirements, support links | BFF fetches from each repo's raw content |
| **Cluster state** | Installed plugins (MODULE_FEDERATION_CONFIG), running deployments, services | Dashboard K8s API pass-through (`/api/k8s`) and dashboard API (`/api/status`) |

### Why BFF

Each page load would otherwise require the frontend to fetch `plugins.yaml` from the charter repo, then fan out to N plugin repos to fetch their `plugin.yaml`. The BFF centralizes this: it fetches, aggregates, and caches plugin metadata server-side, serving a single pre-assembled response to the frontend. This avoids redundant external fetches, reduces latency, and keeps GitHub API rate limits manageable.

### Plugin Lifecycle Operations

| Operation | Mechanism |
|---|---|
| **Install** | Deploy plugin via Helm chart (from OCI registry or chart path declared in `plugin.yaml`), then append entry to `MODULE_FEDERATION_CONFIG` env var on the dashboard deployment |
| **Upgrade** | Update Helm release to new chart version, update image tags |
| **Remove** | Remove entry from `MODULE_FEDERATION_CONFIG`, then `helm uninstall` the plugin release |
| **Enable** | Add plugin entry to `MODULE_FEDERATION_CONFIG` (plugin stays deployed) |
| **Disable** | Remove plugin entry from `MODULE_FEDERATION_CONFIG` (plugin stays deployed but hidden from dashboard) |

### Authentication & RBAC

- **Admins**: Need permissions to modify the `MODULE_FEDERATION_CONFIG` env var on the `rhods-dashboard` deployment in `redhat-ods-applications`, and to manage plugin namespaces (create/delete Deployments, Services via Helm). The BFF forwards the user's Bearer token for all K8s API operations.
- **Non-admins**: Can browse the catalog and view installed plugins (read-only). The frontend checks permissions via `SelfSubjectAccessReview` and hides management actions accordingly.

---

## Navigation & Page Structure

```text
RHOAI Dashboard Sidebar
└── Community Plugins (shared section)
    └── Community Plugins Admin (plugin section)
        ├── Catalog          → /community-plugins-admin/catalog
        └── Installed        → /community-plugins-admin/installed
```

Plugin details are displayed in a **modal** over the catalog or installed page, preserving parent page state (filters, scroll position, search query).

---

## Phases

### Phase 1: Foundation & Project Restructure

**Goal**: Remove seed demo pages, establish the new navigation/routing structure, and set up shared state management.

**Deliverables**:

1. **Remove seed pages and hooks**
   - Delete `UserInfoPage.tsx`, `ClusterResourcesPage.tsx`, `NamespaceSummaryPage.tsx` and their tests
   - Delete `useK8sResources.ts`, `useNamespaceSummary.ts` and their tests
   - Keep `useCurrentUser.ts` (needed for user info / admin detection), `useProjects.ts`, `useFavoriteProjects.ts`, `useAccessReview.ts`

2. **Update extensions.ts**
   - Replace three `app.navigation/href` extensions (UserInfo, ClusterResources, NamespaceSummary) with:
     - `app.navigation/href` for "Catalog" (`/community-plugins-admin/catalog`)
     - `app.navigation/href` for "Installed" (`/community-plugins-admin/installed`)

3. **Update App.tsx routing**
   - New routes: `catalog`, `installed`
   - Default redirect from `/` to `catalog`

4. **Create placeholder pages and components**
   - `CatalogPage.tsx`, `InstalledPage.tsx` (empty shells with titles)
   - `PluginDetailModal.tsx` (empty modal shell, opened from either page)

5. **Update BFF**
   - Remove `namespaceSummary` route and handler
   - Keep health endpoint
   - Prepare route structure for catalog endpoints

6. **Update tests and lint**
   - Remove tests for deleted components
   - Add basic tests for new pages
   - Ensure `npm test` and `npm run lint` pass

**Dependencies**: None (starting point)
**Estimated effort**: 2–3 days

---

### Phase 2: BFF — Plugin Metadata Aggregation

**Goal**: Build the BFF endpoints that fetch, aggregate, and cache plugin metadata from the charter registry and individual plugin repos.

**Deliverables**:

1. **Charter registry client** (`bff/src/services/charterClient.ts`)
   - Fetch `plugins.yaml` from `https://raw.githubusercontent.com/rh-ai-community-plugins/charter/dev/plugins.yaml`
   - Parse YAML into typed plugin list
   - In-memory cache with configurable TTL (default: 5 minutes)
   - Graceful fallback on fetch failure (serve stale cache)

2. **Plugin metadata client** (`bff/src/services/pluginMetadataClient.ts`)
   - For each plugin in the registry, fetch `plugin.yaml` from `{repo-raw-url}/plugin.yaml` (defaulting to `main` branch)
   - Parse and validate against expected schema
   - Per-plugin cache with TTL
   - Concurrent fetches with concurrency limit (avoid GitHub rate limits)
   - Handle missing or malformed `plugin.yaml` gracefully (mark plugin as "metadata unavailable")

3. **Catalog endpoint** (`bff/src/routes/catalog.ts`)
   - `GET /api/catalog` — returns merged list: registry entry + resolved metadata for each plugin
   - Response includes: name, repo, status, maintenance, displayName, description, version, rhoai_compatibility, deployment_model, install method, images, support links
   - Query params: `?refresh=true` to force cache invalidation

4. **Plugin detail endpoint**
   - `GET /api/catalog/:name` — returns full metadata for a single plugin

5. **Unit tests**
   - Charter client with mocked HTTP
   - Metadata client with mocked HTTP, cache hit/miss scenarios
   - Catalog endpoint response shape

**Dependencies**: None (can run in parallel with Phase 1)
**Estimated effort**: 3–4 days

---

### Phase 3: Catalog Page

**Goal**: Build the frontend catalog browsing experience showing all available community plugins.

**Deliverables**:

1. **Catalog data hook** (`src/app/hooks/useCatalog.ts`)
   - Fetches from BFF `GET /community-plugins-admin/api/catalog`
   - Returns plugin list with loading/error states
   - Auto-refresh on mount

2. **Catalog page** (`src/app/pages/CatalogPage.tsx`)
   - PatternFly card grid or table listing all available plugins
   - Each card shows: display name, description, version, status badge (experimental/stable), maintenance tier (Red Hat / community), compatibility info
   - Click card → open Plugin Detail modal

3. **Filtering and search**
   - Text search by name/description
   - Filter by status (experimental, stable)
   - Filter by maintenance tier (Red Hat, community)
   - Filter by install state (available, installed)

4. **Installed status overlay**
   - Cross-reference catalog with currently installed plugins (from `MODULE_FEDERATION_CONFIG`)
   - Show "Installed" badge on cards for plugins already deployed
   - Show version comparison if installed version differs from latest

5. **Unit tests**
   - Hook tests with mocked BFF responses
   - Page rendering, filtering, search behavior

**Dependencies**: Phase 1 (routing), Phase 2 (BFF catalog endpoint)
**Estimated effort**: 3–4 days

---

### Phase 4: Installed Plugins Page

**Goal**: Show the list of currently installed plugins with their status and management actions.

**Deliverables**:

1. **Installed plugins hook** (`src/app/hooks/useInstalledPlugins.ts`)
   - Read `MODULE_FEDERATION_CONFIG` from the dashboard (via `/api/k8s` or dashboard API)
   - Cross-reference with catalog metadata from BFF
   - For each installed plugin: resolve deployment status (running, pending, error) by checking the plugin's Deployment/Service in its namespace
   - Return merged list with install state, health, version info

2. **Installed page** (`src/app/pages/InstalledPage.tsx`)
   - PatternFly table: Name, Version, Status (running/degraded/stopped/unknown), Maintenance, Actions
   - Status column: badge with pod health
   - Actions (admin only): kebab menu with View details, Upgrade, Disable/Enable, Remove
   - Non-admin view: same table without action columns

3. **Admin detection**
   - Use `useCurrentUser` to check the `isAdmin` field from the `/api/status` dashboard endpoint
   - Conditionally render management actions

4. **Unit tests**
   - Hook tests with mocked K8s and catalog responses
   - Admin vs. non-admin rendering
   - Table interactions

**Dependencies**: Phase 1 (routing), Phase 2 (BFF catalog for version comparison)
**Estimated effort**: 3–4 days

---

### Phase 5: Plugin Detail Modal

**Goal**: Show full plugin information in a modal with install/upgrade/remove actions. The modal opens from either the Catalog or Installed page, preserving the parent page's state.

**Deliverables**:

1. **Plugin detail hook** (`src/app/hooks/usePluginDetail.ts`)
   - Fetches from BFF `GET /community-plugins-admin/api/catalog/:name`
   - Resolves installed state from cluster
   - Returns full metadata + install status

2. **Plugin detail modal** (`src/app/components/PluginDetailModal.tsx`)
   - PatternFly Modal (large variant)
   - Header: plugin display name (or name)
   - Description section
   - Compatibility info: min RHOAI version, tested versions
   - Deployment model: cluster-shared / per-project
   - Images: frontend image, BFF image (if applicable)
   - Support links: repo, docs, issues
   - RBAC requirements
   - Install method and prerequisites

3. **Action buttons (admin only)**
   - **Install**: triggers install flow (Phase 6)
   - **Upgrade**: shown when installed version < latest, triggers upgrade flow
   - **Remove**: triggers remove flow with confirmation
   - **Enable/Disable**: toggle dashboard visibility

4. **Unit tests**
   - Modal rendering with various plugin states
   - Action button visibility based on admin status and install state
   - Open/close behavior from both Catalog and Installed pages

**Dependencies**: Phase 2 (BFF detail endpoint), Phase 4 (installed state resolution)
**Estimated effort**: 2–3 days

---

### Phase 6: Plugin Install / Upgrade / Remove

**Goal**: Implement the actual plugin lifecycle operations triggered from the UI.

**Deliverables**:

1. **Install flow**
   - Read the plugin's `install` config from its `plugin.yaml` (method, Helm chart, prerequisites)
   - For `automatic` install method:
     - Create target namespace if needed
     - Run `helm install` via BFF (BFF executes Helm operations using its ServiceAccount)
     - Append plugin entry to `MODULE_FEDERATION_CONFIG` env var on `rhods-dashboard` deployment
     - Wait for pods to become ready
   - For `assisted` method: show instructions and prerequisites, let admin confirm each step
   - For `manual` method: display instructions link only
   - Progress modal with step-by-step status

2. **Upgrade flow**
   - `helm upgrade` to new chart version
   - Update image tags if changed
   - Rolling restart of plugin pods
   - Progress feedback

3. **Remove flow**
   - Confirmation modal (require plugin name re-typing)
   - Remove entry from `MODULE_FEDERATION_CONFIG`
   - `helm uninstall` the plugin release
   - Optionally delete the namespace
   - Progress feedback

4. **Enable/Disable flow**
   - Enable: add plugin's Module Federation entry to `MODULE_FEDERATION_CONFIG`
   - Disable: remove plugin's entry from `MODULE_FEDERATION_CONFIG`
   - Dashboard pods roll out automatically after env var change

5. **BFF endpoints for lifecycle operations** (`bff/src/routes/lifecycle.ts`)
   - `POST /api/plugins/:name/install` — install a plugin
   - `POST /api/plugins/:name/upgrade` — upgrade a plugin
   - `DELETE /api/plugins/:name` — remove a plugin
   - `POST /api/plugins/:name/enable` — enable a plugin
   - `POST /api/plugins/:name/disable` — disable a plugin
   - Each endpoint: validate permissions, execute operation, return status

6. **BFF RBAC requirements**
   - ServiceAccount needs permissions to:
     - Read/modify the `rhods-dashboard` Deployment env vars in `redhat-ods-applications`
     - Create/delete namespaces for plugin deployments
     - Create/delete Helm releases (Deployments, Services, ConfigMaps, ServiceAccounts, etc.)
   - Helm chart must provision these RBAC resources

7. **Unit tests**
   - Install/upgrade/remove flow tests with mocked K8s API
   - MODULE_FEDERATION_CONFIG manipulation tests
   - Error handling (failed install, partial cleanup)

**Dependencies**: Phase 5 (detail modal with action buttons), Phase 2 (BFF)
**Estimated effort**: 7–10 days

---

### Phase 7: Helm Chart & Deployment Updates

**Goal**: Update the Helm chart and CI/CD for the admin plugin's own deployment and RBAC needs.

**Deliverables**:

1. **BFF RBAC resources in Helm chart**
   - ServiceAccount for BFF
   - ClusterRole with permissions to:
     - Get/update Deployments in `redhat-ods-applications` (for MODULE_FEDERATION_CONFIG)
     - Create/delete namespaces
     - Manage Helm-deployed resources across namespaces
   - ClusterRoleBinding binding the ServiceAccount

2. **Helm chart values**
   - Add BFF RBAC toggle (`bff.rbac.create: true`)
   - Add charter registry URL as configurable value
   - Add cache TTL configuration

3. **Plugin manifest** (`plugin.yaml`)
   - Update `rbac` section to declare required cluster roles
   - Update description and feature list

4. **CI/CD workflows**
   - Ensure CI runs BFF tests
   - Update build-push to handle both images

5. **Documentation**
   - Update `docs/deployment/OPENSHIFT_DEPLOY.md` with RBAC prerequisites
   - Document the BFF's ServiceAccount permissions

**Dependencies**: Phase 6 (lifecycle operations define RBAC needs)
**Estimated effort**: 2–3 days

---

### Phase 8: Testing, Polish & Documentation

**Goal**: Comprehensive testing, UX polish, and documentation updates.

**Deliverables**:

1. **Integration testing**
   - End-to-end flow: browse catalog → open detail modal → install plugin → verify in installed list → disable → enable → upgrade → remove
   - Test admin vs. non-admin experience
   - Test with real charter registry and plugin repos

2. **UX polish**
   - Loading states and skeleton screens on all pages
   - Error boundaries with meaningful messages
   - Empty states (no plugins installed, catalog unavailable)
   - Responsive layout
   - Keyboard navigation and accessibility (a11y)

3. **Edge cases and error handling**
   - Charter registry unreachable
   - Plugin repo unreachable or missing `plugin.yaml`
   - Partial install failure (Helm succeeded but MODULE_FEDERATION_CONFIG update failed)
   - Concurrent admin operations (two admins installing different plugins)
   - Plugin already installed externally (not via this admin tool)
   - Dashboard restart timing after MODULE_FEDERATION_CONFIG changes

4. **Documentation updates**
   - Update `AGENTS.md` / `CLAUDE.md` with new architecture
   - Update `docs/architecture/` with catalog and lifecycle system docs
   - Update `docs/development/` with local setup for BFF catalog endpoints
   - Update `README.md` with final feature set

**Dependencies**: All previous phases
**Estimated effort**: 3–5 days

---

## Summary

| Phase | Description | Effort | Dependencies |
|---|---|---|---|
| 1 | Foundation & Project Restructure | 2–3 days | — |
| 2 | BFF — Plugin Metadata Aggregation | 3–4 days | — |
| 3 | Catalog Page | 3–4 days | Phases 1, 2 |
| 4 | Installed Plugins Page | 3–4 days | Phases 1, 2 |
| 5 | Plugin Detail Modal | 2–3 days | Phases 2, 4 |
| 6 | Plugin Install / Upgrade / Remove | 7–10 days | Phases 2, 5 |
| 7 | Helm Chart & Deployment Updates | 2–3 days | Phase 6 |
| 8 | Testing, Polish & Documentation | 3–5 days | All |
| **Total** | | **25–36 days** | |

### Parallelization Opportunities

Phases 1 and 2 can run in parallel (frontend cleanup vs. BFF development).
Phases 3 and 4 can run in parallel once Phases 1 and 2 are done.
Phase 7 can partially overlap with Phase 6.
Phase 8 is incremental and can start during Phase 5.

### Critical Path

Phase 2 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8

---

## Open Questions & Future Considerations

1. **Helm execution from BFF**: The BFF needs to run Helm operations. Should it shell out to the `helm` CLI (simpler, requires Helm binary in the container) or use a Helm Go library via a sidecar/separate service? Alternatively, should it create K8s resources directly instead of using Helm?

2. **MODULE_FEDERATION_CONFIG management**: Currently stored as an env var on the dashboard deployment. Modifying it triggers a rolling restart. Should this plugin manage it via ConfigMap instead for cleaner updates? Does the dashboard support ConfigMap-based federation config?

3. **Charter registry branch**: Currently reading from the `dev` branch. Should this be configurable (e.g., `main` for production, `dev` for testing)?

4. **Plugin version resolution**: When a plugin's `plugin.yaml` declares compatibility with specific RHOAI versions, should the admin plugin enforce this and prevent installing incompatible plugins?

5. **Self-management**: Can this plugin manage (upgrade/remove) itself? This creates a bootstrapping problem — removing the admin plugin removes the ability to reinstall it without manual `MODULE_FEDERATION_CONFIG` editing.

6. **Offline / air-gapped clusters**: The BFF fetches metadata from GitHub. How should the plugin behave in disconnected environments? Should it support a local/mirrored registry?

7. **Plugin dependencies**: Some plugins may depend on others (e.g., a plugin that requires a shared backend). Should the install flow handle dependency resolution?

8. **Audit trail**: Should plugin install/upgrade/remove operations be logged (e.g., as K8s Events) for auditability?
