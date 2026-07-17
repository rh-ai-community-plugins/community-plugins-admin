# Project Layout

Directory structure of the plugin.

```text
.
├── src/
│   ├── index.ts                     # Webpack entry — dynamic import to bootstrap.tsx
│   ├── bootstrap.tsx                # React 18 root render (async bootstrap required by Module Federation)
│   ├── typings.d.ts                 # Global type declarations (CSS modules, SVG)
│   ├── rhoai/                       # [DASHBOARD INTEGRATION] — what the host loads
│   │   ├── extensions.ts            #   Extension declarations (area, nav sections, nav items, route)
│   │   └── CommunityNavIcon.tsx     #   [SHARED] Sidebar icon for the community-plugins section — do not modify
│   └── app/                         # [PLUGIN CODE] — your actual plugin
│       ├── App.tsx                  #   Router + CommunityBanner layout + ErrorBoundary
│       ├── components/             #   Shared UI components
│       │   ├── CommunityBanner.tsx  #     [SHARED] "Community Plugin" banner — do not modify
│       │   ├── CommunityBanner.css  #     [SHARED] Banner styles — do not modify
│       │   ├── CommunityPluginsAdminNavIcon.tsx  # Plugin's sidebar icon
│       │   ├── PluginDetailModal.tsx #    Plugin detail modal with metadata and lifecycle actions
│       │   ├── ConfirmRemoveModal.tsx #   Confirmation dialog for plugin removal (name re-typing)
│       │   └── LifecycleProgressModal.tsx # Step-by-step progress for lifecycle operations
│       ├── pages/                  #   One file per page/route
│       │   ├── CatalogPage.tsx     #     Browse available plugins (card grid, search, filters)
│       │   └── InstalledPage.tsx    #     View/manage installed plugins (table, admin actions)
│       ├── hooks/                  #   Data-fetching and state hooks
│       │   ├── useCurrentUser.ts   #     Dashboard API — user info and admin detection
│       │   ├── useProjects.ts      #     K8s API — accessible projects
│       │   ├── useFavoriteProjects.ts  # localStorage-backed project favorites
│       │   ├── useLastSelectedProject.ts  # localStorage-backed last project
│       │   ├── useAccessReview.ts  #     RBAC check via SelfSubjectAccessReview
│       │   ├── useCatalog.ts       #     BFF — merged plugin catalog with cache
│       │   ├── useInstalledPluginNames.ts  # Dashboard — MODULE_FEDERATION_CONFIG reader
│       │   ├── useHelmReleasedPlugins.ts   # BFF — all Helm releases with version map
│       │   ├── useInstalledPlugins.ts      # Merged installed state with health status
│       │   ├── usePluginDetail.ts  #     BFF — single plugin metadata + installed state
│       │   └── usePluginLifecycle.ts #   BFF — install/upgrade/remove/enable/disable operations
│       ├── types/                  #   TypeScript type definitions
│       │   ├── catalog.ts          #     CatalogPlugin type (BFF response)
│       │   ├── installed.ts        #     InstalledPlugin, PluginHealthStatus types
│       │   └── lifecycle.ts        #     LifecycleResult, LifecycleStep types
│       └── utils/
│           └── maintenance.ts      #     Label color/text helpers for status, maintenance, deployment
├── config/                          # Webpack configs
│   ├── webpack.common.js            #   Module Federation setup, loaders, path alias (~ → src)
│   ├── webpack.dev.js               #   Dev server (port 9500), proxy rules
│   └── webpack.prod.js              #   Production build to dist/
├── bff/                             # Backend-For-Frontend service
│   ├── package.json                 #   Express + TypeScript project
│   ├── tsconfig.json
│   ├── Containerfile                #   UBI9 Node 22 + Helm binary, port 3000
│   └── src/
│       ├── app.ts                   #   Express app (middleware, route mounting, health endpoint)
│       ├── server.ts                #   HTTP server entry (listen + K8s config logging)
│       ├── routes/
│       │   ├── catalog.ts           #     GET /api/catalog, GET /api/catalog/:name
│       │   └── lifecycle.ts         #     Plugin lifecycle endpoints (install/upgrade/remove/enable/disable)
│       ├── services/
│       │   ├── charterClient.ts     #     Charter registry fetcher with caching
│       │   ├── pluginMetadataClient.ts  # Plugin metadata fetcher with per-plugin cache
│       │   ├── dashboardConfigService.ts  # MODULE_FEDERATION_CONFIG reader/writer
│       │   ├── helmService.ts       #     Helm CLI executor (install/upgrade/uninstall/list)
│       │   ├── lifecycleService.ts  #     Lifecycle orchestrator (resolve → Helm → config)
│       │   └── k8sApiClient.ts      #     K8s API HTTP client with CA cert caching
│       ├── types/
│       │   ├── catalog.ts           #     RegistryPlugin, PluginMetadata, CatalogPlugin
│       │   ├── lifecycle.ts         #     InstallRequest, UpgradeRequest types
│       │   └── js-yaml.d.ts         #     Module declaration
│       └── utils/
│           ├── httpClient.ts        #     HTTP fetch with redirect following
│           └── k8sClient.ts         #     K8s API base URL resolution
├── chart/                           # Helm chart for OpenShift deployment
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── _helpers.tpl             #   Template helpers
│       ├── deployment.yaml          #   Frontend deployment (Nginx)
│       ├── service.yaml             #   Frontend service (port 8080)
│       ├── serviceaccount.yaml      #   Frontend service account
│       ├── bff-deployment.yaml      #   BFF deployment (Node.js + Helm)
│       ├── bff-service.yaml         #   BFF service (port 3000)
│       ├── bff-serviceaccount.yaml  #   BFF service account
│       ├── bff-clusterrole.yaml     #   BFF RBAC — cluster-level permissions
│       └── bff-clusterrolebinding.yaml  # BFF RBAC — binds role to SA
├── scripts/
│   ├── build-push.sh                #   Build and push container images to Quay.io
│   ├── scan-image.sh                #   Build and scan images with Trivy
│   └── sync-chart-version.js        #   Sync version across package.json, Chart.yaml, plugin.yaml
├── Makefile                         # Build, test, image, and chart targets (run `make help`)
├── plugin.yaml                      # Plugin metadata for the RHOAI registry
├── Containerfile                    # Frontend container (Nginx)
└── bff/Containerfile                # BFF container (Node.js)
```

## Codebase orientation

1. **Read** `src/rhoai/extensions.ts` — this is what the dashboard loads. It defines your nav items and routes.
2. **Add pages** under `src/app/pages/` and corresponding nav entries in `extensions.ts`.
3. **Add hooks** under `src/app/hooks/` for data fetching.
4. **Add BFF endpoints** under `bff/src/routes/` with services in `bff/src/services/`.

## Shared vs plugin-specific

Files marked `[SHARED]` are common to all community plugins. Do not rename, remove, or modify them — they ensure a consistent experience across the community plugin ecosystem:

| File | Purpose |
|---|---|
| `src/rhoai/CommunityNavIcon.tsx` | Common sidebar icon for the community-plugins nav section |
| `src/app/components/CommunityBanner.tsx` | "Community Plugin" banner displayed on every page |
| `src/app/components/CommunityBanner.css` | Styles for the banner |
| `communityPluginsSectionExtension` in `extensions.ts` | Shared nav section that groups all community plugins |

Everything else is yours to change. See [CUSTOMIZATION.md](CUSTOMIZATION.md) for the full list of identifiers to update.
