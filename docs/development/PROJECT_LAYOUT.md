# Project Layout

Directory structure of the plugin.

```text
.
├── src/
│   ├── index.ts                     # Webpack entry — dynamic import to bootstrap.tsx
│   ├── bootstrap.tsx                # React 18 root render (async bootstrap required by Module Federation)
│   ├── rhoai/                       # [DASHBOARD INTEGRATION] — what the host loads
│   │   ├── extensions.ts            #   Extension declarations (area, nav sections, nav items, route)
│   │   └── CommunityNavIcon.tsx     #   [SHARED] Sidebar icon for the community-plugins section — do not modify
│   └── app/                         # [PLUGIN CODE] — your actual plugin
│       ├── App.tsx                  #   Router + CommunityBanner layout
│       ├── components/             #   Shared UI components
│       │   ├── CommunityBanner.tsx  #     [SHARED] "Community Plugin" banner — do not modify
│       │   ├── CommunityBanner.css  #     [SHARED] Banner styles — do not modify
│       │   ├── CommunityPluginsAdminNavIcon.tsx#     [PLUGIN-SPECIFIC] Your plugin's sidebar icon
│       │   └── PluginDetailModal.tsx #    Plugin detail modal (placeholder for Phase 5)
│       ├── pages/                  #   One file per page/route
│       │   ├── CatalogPage.tsx     #     Browse available community plugins
│       │   └── InstalledPage.tsx    #     View and manage installed plugins
│       └── hooks/                  #   Data-fetching hooks
│           ├── useCurrentUser.ts   #     Dashboard API
│           ├── useProjects.ts      #     K8s API
│           ├── useFavoriteProjects.ts  # localStorage-backed project favorites
│           ├── useLastSelectedProject.ts  # localStorage-backed last project
│           └── useAccessReview.ts  #     RBAC check via SelfSubjectAccessReview
├── config/                          # Webpack configs
│   ├── webpack.common.js            #   Module Federation setup, loaders, path alias (~ → src)
│   ├── webpack.dev.js               #   Dev server (port 9500), proxy rules
│   └── webpack.prod.js              #   Production build to dist/
├── bff/                             # Backend-For-Frontend service
│   └── src/
│       ├── server.ts                #   Express server entry (health endpoint)
│       ├── types.ts                 #   K8s resource types (retained for future endpoints)
│       └── utils/
│           └── k8sClient.ts         #   Authenticated K8s API caller (retained for future endpoints)
├── chart/                           # Helm chart for OpenShift deployment
├── Makefile                         # Build, test, image, and chart targets (run `make help`)
├── plugin.yaml                      # Plugin metadata for the RHOAI registry
├── Containerfile                    # Frontend container (Nginx)
└── bff/Containerfile                # BFF container (Node.js)
```

## Codebase orientation

1. **Read** `src/rhoai/extensions.ts` — this is what the dashboard loads. It defines your nav items and routes.
2. **Add pages** under `src/app/pages/` and corresponding nav entries in `extensions.ts`.
3. **Add hooks** under `src/app/hooks/` for data fetching.

## Shared vs plugin-specific

Files marked `[SHARED]` are common to all community plugins. Do not rename, remove, or modify them — they ensure a consistent experience across the community plugin ecosystem:

| File | Purpose |
|---|---|
| `src/rhoai/CommunityNavIcon.tsx` | Common sidebar icon for the community-plugins nav section |
| `src/app/components/CommunityBanner.tsx` | "Community Plugin" banner displayed on every page |
| `src/app/components/CommunityBanner.css` | Styles for the banner |
| `communityPluginsSectionExtension` in `extensions.ts` | Shared nav section that groups all community plugins |

Everything else is yours to change. See [CUSTOMIZATION.md](CUSTOMIZATION.md) for the full list of identifiers to update.
