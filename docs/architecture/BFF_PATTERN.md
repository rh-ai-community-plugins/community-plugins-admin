# BFF (Backend For Frontend) Pattern

This document explains the BFF pattern as implemented in this plugin.

---

## What is the BFF Pattern?

The BFF (Backend For Frontend) pattern gives a plugin its own backend service. Instead of the frontend making direct K8s API calls through the dashboard's `/api/k8s/*` pass-through, it calls the plugin's own backend, which performs server-side logic and returns processed results.

### When to Use a BFF

- **Server-side aggregation** -- Combine multiple API calls into a single response (e.g., fetching and merging plugin metadata from multiple repos)
- **External service integration** -- Call third-party APIs using credentials stored server-side (API keys never reach the browser)
- **Complex business logic** -- Processing that would be too expensive or impractical in the browser
- **Data transformation** -- Heavy filtering, sorting, or enrichment before sending data to the frontend
- **Lifecycle operations** -- Execute Helm CLI commands and manage K8s resources server-side on behalf of the user

### When NOT to Use a BFF

- Simple CRUD on K8s resources -- use the dashboard's `/api/k8s/*` pass-through instead
- Reading dashboard config or user info -- use `/api/status`, `/api/config`, etc.
- Anything the dashboard backend already provides (see `DASHBOARD_APIS.md`)

---

## How It Works

### Token Flow

```text
Browser                    Dashboard Backend              Plugin BFF              K8s API
  |                              |                            |                     |
  |-- fetch('/community-plugins-admin/api/catalog') -------->|                     |
  |                              |                            |                     |
  |                    [matches proxyService path]             |                     |
  |                    [authorize: true]                       |                     |
  |                              |                            |                     |
  |                              |-- GET /api/catalog         |                     |
  |                              |   Authorization: Bearer <user-token>             |
  |                              |--------------------------->|                     |
  |                              |                            |                     |
  |                              |                            |-- fetch GitHub      |
  |                              |                            |   (charter registry)|
  |                              |                            |                     |
  |                              |<-- [{ name, ... }] --------|                     |
  |<-- JSON response ------------|                            |                     |
```

Key points:

1. The frontend calls a path like `/community-plugins-admin/api/catalog` at the same origin
2. The dashboard backend matches this against `proxyService` entries in the federation ConfigMap
3. When `authorize: true`, the dashboard converts the user's `x-forwarded-access-token` into an `Authorization: Bearer <token>` header
4. The BFF receives the user's actual OpenShift token and uses it for K8s API calls -- all RBAC permissions are the user's own

### Dashboard Proxy Configuration

The dashboard discovers BFF services via the `proxyService` field in the federation ConfigMap:

```json
{
  "name": "communityPluginsAdmin",
  "backend": {
    "remoteEntry": "/remoteEntry.js",
    "service": { "name": "community-plugins-admin", "namespace": "community-plugins-admin", "port": 8080 }
  },
  "proxyService": [{
    "path": "/community-plugins-admin/api",
    "pathRewrite": "/api",
    "authorize": true,
    "tls": false,
    "service": { "name": "community-plugins-admin-bff", "namespace": "community-plugins-admin", "port": 3000 }
  }]
}
```

| Field | Purpose |
|---|---|
| `path` | URL prefix the dashboard intercepts |
| `pathRewrite` | Replacement prefix forwarded to the BFF |
| `authorize` | Forward the user's Bearer token |
| `service` | K8s Service name, namespace, and port for the BFF |

---

## This Plugin's BFF Implementation

### Directory Structure

```text
bff/
  package.json              # Express + TypeScript project
  tsconfig.json
  Containerfile             # UBI9 Node 22 + Helm binary, runs on port 3000
  src/
    app.ts                  # Express app (middleware, route mounting, health endpoint)
    server.ts               # HTTP server entry (listen + K8s config logging)
    routes/
      catalog.ts            # GET /api/catalog, GET /api/catalog/:name
      lifecycle.ts          # GET /api/plugins, POST install/upgrade/enable/disable, DELETE remove
    services/
      charterClient.ts      # Fetches plugins.yaml from the charter registry (GitHub)
      pluginMetadataClient.ts # Fetches plugin.yaml from individual plugin repos
      dashboardConfigService.ts # Reads/modifies MODULE_FEDERATION_CONFIG on rhods-dashboard
      helmService.ts        # Executes Helm CLI operations (install/upgrade/uninstall/list)
      lifecycleService.ts   # Orchestrates lifecycle operations (chart resolve → Helm → config)
      k8sApiClient.ts       # Low-level K8s API HTTP client with CA cert caching
    types/
      catalog.ts            # RegistryPlugin, PluginMetadata, CatalogPlugin types
      lifecycle.ts          # InstallRequest, UpgradeRequest types
      js-yaml.d.ts          # Module declaration for js-yaml
    utils/
      httpClient.ts         # HTTP fetch with redirect following
      k8sClient.ts          # K8s API base URL resolution
  __tests__/
    catalogRoutes.test.ts
    lifecycleRoute.test.ts
    charterClient.test.ts
    pluginMetadataClient.test.ts
    httpClient.test.ts
    helmService.test.ts
    lifecycleService.test.ts
    dashboardConfigService.test.ts
    k8sClient.test.ts
    k8sApiClient.test.ts
```

### Endpoints

#### `GET /api/health`

Returns `{ status: "ok" }`. Used by liveness probes and to verify the BFF is reachable through the dashboard proxy.

#### `GET /api/catalog`

Returns a merged list of all community plugins. Each entry combines the charter registry data with resolved metadata from the plugin's own `plugin.yaml`. Supports `?refresh=true` to force cache invalidation.

Response fields include: `name`, `repo`, `status`, `maintenance`, `displayName`, `description`, `version`, `rhoaiCompatibility`, `deploymentModel`, `install`, `rbac`, `remote`, `support`, and more.

#### `GET /api/catalog/:name`

Returns full metadata for a single plugin by name.

#### `GET /api/plugins`

Lists all Helm-deployed plugin releases across namespaces. Returns `{ releases: [...] }` with each release's name, namespace, chart, and app version.

#### `POST /api/plugins/:name/install`

Installs a plugin via Helm. Request body:
- `namespace` (optional) — target namespace, defaults to plugin name
- `values` (optional) — Helm values to override

Steps: resolve chart from registry metadata → `helm install` → add entry to `MODULE_FEDERATION_CONFIG`.

#### `POST /api/plugins/:name/upgrade`

Upgrades a plugin to the latest chart version. Discovers the existing namespace from Helm releases.

#### `DELETE /api/plugins/:name`

Removes a plugin. Query param `?deleteNamespace=true` also deletes the namespace. Steps: remove from `MODULE_FEDERATION_CONFIG` → `helm uninstall` → optionally delete namespace.

#### `POST /api/plugins/:name/enable`

Adds the plugin's Module Federation entry to `MODULE_FEDERATION_CONFIG`, making it visible in the dashboard without redeploying.

#### `POST /api/plugins/:name/disable`

Removes the plugin's entry from `MODULE_FEDERATION_CONFIG`. The plugin stays deployed but is hidden from the dashboard.

### Services

#### Charter Client (`charterClient.ts`)

Fetches and parses `plugins.yaml` from the charter registry on GitHub. Features:
- In-memory cache with configurable TTL (`CHARTER_CACHE_TTL_MS`, default 5 min)
- Stale-while-revalidate: serves cached data on fetch failure
- Force refresh support

#### Plugin Metadata Client (`pluginMetadataClient.ts`)

Fetches `plugin.yaml` from each plugin's GitHub repo. Features:
- Per-plugin cache with TTL (`PLUGIN_CACHE_TTL_MS`)
- Concurrent fetch limit (`PLUGIN_FETCH_CONCURRENCY`, default 5)
- Graceful handling of missing/malformed metadata

#### Dashboard Config Service (`dashboardConfigService.ts`)

Reads and modifies `MODULE_FEDERATION_CONFIG` on the `rhods-dashboard` deployment in `redhat-ods-applications`. Features:
- JSON Patch operations for adding/removing plugin entries
- Optimistic concurrency control with 409 conflict retry
- Scope conversion between camelCase (federation config) and kebab-case (internal)

#### Helm Service (`helmService.ts`)

Executes Helm CLI operations. Features:
- Temporary kubeconfig files (no tokens in CLI arguments)
- Helm values validation
- Namespace discovery from existing releases
- Install, upgrade, uninstall, and list operations

#### Lifecycle Service (`lifecycleService.ts`)

Orchestrates plugin lifecycle by coordinating:
1. Chart resolution from registry + plugin metadata
2. Helm execution (install/upgrade/uninstall)
3. Dashboard config updates (add/remove federation entries)

Error messages are sanitized to redact tokens and sensitive data.

#### K8s API Client (`k8sApiClient.ts`)

Low-level HTTP client for K8s API calls. Features:
- CA certificate caching (positive and negative)
- TLS insecure mode via `K8S_TLS_INSECURE` env var
- Request timeout and response size limits

### K8s Client (`k8sClient.ts`)

Resolves the K8s API base URL:
- **In-cluster**: Uses `KUBERNETES_SERVICE_HOST` and `KUBERNETES_SERVICE_PORT` env vars
- **Local dev**: Uses the `K8S_API_BASE` env var

The BFF uses the user's forwarded token for operations that require user-level RBAC (e.g., checking permissions). For lifecycle operations (Helm install/upgrade/uninstall), it uses its own ServiceAccount token.

---

## Deployment

The BFF runs as a separate Deployment and Service in the Helm chart, with RBAC resources for lifecycle operations:

- **Deployment**: `community-plugins-admin-bff` -- Node.js container on port 3000 with Helm binary
- **Service**: `community-plugins-admin-bff` -- ClusterIP service exposing port 3000
- **ServiceAccount**: `community-plugins-admin-bff` -- Identity for BFF pod RBAC
- **ClusterRole**: `community-plugins-admin-bff` -- Permissions for lifecycle operations
- **ClusterRoleBinding**: Binds the ClusterRole to the ServiceAccount

All BFF resources are gated by `.Values.bff.enabled` (default: `true`).

The BFF Service name in `values.yaml` must match the `proxyService.service.name` in the dashboard's federation ConfigMap.

### RBAC Permissions

The BFF ClusterRole grants permissions required for plugin lifecycle management:

| Resource | Verbs | Purpose |
|---|---|---|
| Deployments (apps) | get, list, update, patch | Read/modify `MODULE_FEDERATION_CONFIG` on `rhods-dashboard` |
| Namespaces | get, list, create, update, patch, delete | Create/delete plugin namespaces |
| Deployments, Services, ConfigMaps, ServiceAccounts, Secrets | get, list, create, update, patch, delete | Manage Helm-deployed plugin resources |
| ClusterRoles, ClusterRoleBindings | get, list, create, update, patch, delete | Manage RBAC for deployed plugins |

---

## Local Development

The BFF runs as a separate Node.js process alongside the plugin dev server and the dashboard. See [LOCAL_SETUP.md](../development/LOCAL_SETUP.md) for full step-by-step instructions.

### Three-process setup

| Process | Port | What it does |
|---|---|---|
| Dashboard (container or source) | 8443 | Host app; proxies frontend and BFF requests |
| BFF service | 3000 | Plugin backend; aggregates metadata, executes lifecycle operations |
| Plugin dev server | 9500 | Plugin frontend; serves webpack bundles with HMR |

### Starting the BFF

```bash
cd bff
npm install                                              # first time only
K8S_API_BASE=$(oc whoami --show-server) npm run start:dev # must set K8S_API_BASE
```

**`K8S_API_BASE` is required.** When the BFF runs locally (not in-cluster), it doesn't have access to the `KUBERNETES_SERVICE_HOST` and `KUBERNETES_SERVICE_PORT` env vars that Kubernetes provides to pods. `K8S_API_BASE` tells the BFF where to find the cluster API server. Without it, all K8s API calls will fail and the endpoint returns 502.

### Dashboard proxy configuration

The dashboard must include a `proxyService` entry in `MODULE_FEDERATION_CONFIG` to route `/community-plugins-admin/api/*` requests to the BFF:

```json
"proxyService": [{
  "path": "/community-plugins-admin/api",
  "pathRewrite": "/api",
  "authorize": true,
  "tls": false,
  "localService": { "host": "localhost", "port": 3000 },
  "service": { "name": "placeholder", "namespace": "opendatahub", "port": 3000 }
}]
```

Without this entry, the dashboard won't proxy BFF requests and the frontend will receive HTML (the SPA fallback) instead of JSON.

### Standalone frontend development

The webpack dev server (`config/webpack.dev.js`) also has a proxy entry for `/community-plugins-admin/api` that forwards to `localhost:3000`. This allows developing the frontend against the BFF without the full dashboard, but note that no user token will be forwarded in this mode.
