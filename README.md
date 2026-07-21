# Community Plugins Admin

A community plugin for the **Red Hat OpenShift AI (RHOAI) Dashboard** that lets administrators discover, install, upgrade, remove, enable, and disable community plugins — directly from the dashboard UI.

## Overview

Community Plugins Admin is designed to be the **first plugin** installed on an RHOAI dashboard. Once in place, it provides a self-service interface for managing all other community plugins without manual `MODULE_FEDERATION_CONFIG` edits or Helm operations.

### What It Does

| Capability | Admin | Non-admin |
|---|---|---|
| **Browse catalog** of available community plugins | Yes | Yes |
| **View installed plugins** and their status | Yes | Yes |
| **Install / upgrade / remove** plugins | Yes | No |
| **Enable / disable** plugins (hide from dashboard without uninstalling) | Yes | No |

### How It Works

The plugin reads the community plugin registry maintained in the [rh-ai-community-plugins/charter](https://github.com/rh-ai-community-plugins/charter) repository. Each registered plugin publishes its own `plugin.yaml` at its repo root, which describes identity, version, compatibility, deployment model, and installation method. The BFF (Backend For Frontend) service aggregates this metadata server-side to build the catalog.

**Lifecycle operations** (install, upgrade, remove) are executed via Helm through the BFF service, which also manages `MODULE_FEDERATION_CONFIG` on the dashboard deployment to register/unregister plugins. Enable/disable operations modify the federation config without touching the Helm release.

The BFF runs with a dedicated ServiceAccount that has cluster-level RBAC permissions for managing plugin deployments, namespaces, and the dashboard's federation configuration. All user-initiated operations forward the user's Bearer token for RBAC-scoped API calls.

### BFF API

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Liveness probe |
| `/api/catalog` | GET | Merged plugin catalog (supports `?refresh=true`) |
| `/api/catalog/:name` | GET | Single plugin metadata |
| `/api/plugins` | GET | All Helm-deployed plugin releases |
| `/api/plugins/:name/install` | POST | Install a plugin via Helm |
| `/api/plugins/:name/upgrade` | POST | Upgrade a plugin |
| `/api/plugins/:name` | DELETE | Remove a plugin (supports `?deleteNamespace=true`) |
| `/api/plugins/:name/enable` | POST | Enable a disabled plugin |
| `/api/plugins/:name/disable` | POST | Disable a plugin (hide from dashboard) |

## Quick Start

### Deploy on an Existing Dashboard

**Prerequisites:** Helm, `oc` CLI access to the cluster, and access to the `redhat-ods-applications` namespace (typically requires cluster-admin).

#### 1. Install the plugin

Install directly from the OCI registry — no need to clone this repo:

```bash
helm install community-plugins-admin oci://quay.io/rh-ai-community-plugins/community-plugins-admin-chart \
  --version 0.1.1 \
  --namespace community-plugins-admin \
  --create-namespace
```

Or, if you have a local checkout of the repository:

```bash
helm install community-plugins-admin chart/ \
  --namespace community-plugins-admin \
  --create-namespace
```

This creates a Deployment and Service for both the frontend (`community-plugins-admin`, serving `remoteEntry.js` via Nginx) and the BFF (`community-plugins-admin-bff`, Node.js backend on port 3000). To deploy the frontend only, add `--set bff.enabled=false`.

#### 2. Register with the RHOAI Dashboard

Retrieve the current Module Federation configuration from the dashboard, append the plugin entry, and apply it:

```bash
oc get configmap federation-config \
  -n redhat-ods-applications \
  -o jsonpath='{.data.module-federation-config\.json}' \
| python3 -c "
import json, sys
config = json.load(sys.stdin)
config.append({
  'name': 'communityPluginsAdmin',
  'backend': {
    'remoteEntry': '/remoteEntry.js',
    'authorize': False,
    'tls': False,
    'service': {
      'name': 'community-plugins-admin',
      'namespace': 'community-plugins-admin',
      'port': 8080
    }
  },
  'proxyService': [{
    'path': '/community-plugins-admin/api',
    'pathRewrite': '/api',
    'authorize': True,
    'tls': False,
    'service': {
      'name': 'community-plugins-admin-bff',
      'namespace': 'community-plugins-admin',
      'port': 3000
    }
  }]
})
print(json.dumps(config))
" > /tmp/mf-config-extended.json

oc set env deployment/rhods-dashboard \
  -n redhat-ods-applications \
  "MODULE_FEDERATION_CONFIG=$(cat /tmp/mf-config-extended.json)"
```

New dashboard pods roll out automatically. After roughly two minutes, reload the RHOAI dashboard to see the plugin's sidebar entries.

#### 3. Verify

Confirm the plugin is registered in the dashboard configuration:

```bash
oc set env deployment/rhods-dashboard -n redhat-ods-applications --list \
  | grep '^MODULE_FEDERATION_CONFIG=' \
  | head -n1 \
  | python3 -c "import json,sys; d=json.loads(sys.stdin.read().split('=',1)[1].strip()); print('\n'.join(e['name'] for e in d))"
```

You should see `communityPluginsAdmin` in the list of registered plugins.

To deploy your own plugin image instead, see [Build & Push](docs/development/BUILD_AND_PUSH.md). For the full deployment guide with Helm chart customization and BFF registration, see [Deploying on OpenShift](docs/deployment/OPENSHIFT_DEPLOY.md).

### Local Development

Developing a dashboard plugin is easier with a **running RHOAI dashboard** connected to a **real OpenShift cluster** — the plugin runs inside the dashboard and relies on its backend to proxy API calls to the cluster.

There are two approaches to set up this environment:

- **Container-based** (recommended) — Run the dashboard as a container image alongside your plugin dev server. Faster to set up.
- **Source-based** — Clone and run the [odh-dashboard](https://github.com/opendatahub-io/odh-dashboard) from source alongside your plugin. More involved setup, but provides full hot module replacement for both the dashboard and the plugin.

Both methods require Node.js 20+, `oc` CLI access to the cluster, and cluster-admin privileges. Once the environment is running:

```bash
npm install              # Install plugin dependencies
npm run start:dev        # Start the plugin dev server on port 9500
```

If you want to work with the BFF service, you also need to start it:

```bash
cd bff
npm install              # Install BFF dependencies (first time only)
K8S_API_BASE=$(oc whoami --show-server) npm run start:dev   # Start BFF on port 3000
```

See the full [Local Setup Guide](docs/development/LOCAL_SETUP.md) for step-by-step instructions on both methods, including dashboard proxy configuration for the BFF.

#### Build & Test

```bash
npm run build           # Production build to dist/
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Tests with coverage report
npm run lint            # ESLint on src/ + markdownlint on **/*.md
```

A `Makefile` is also available for unified operations across frontend and BFF — run `make help` for the full list of targets.

## Documentation

See the [docs/](docs/) directory for detailed guides:

- **[Architecture](docs/architecture/)** — Plugin system internals, extension contract, and BFF pattern
- **[Development](docs/development/)** — Local environment setup, customization guide, and backend API reference
- **[Deployment](docs/deployment/)** — Deploying the plugin on OpenShift with Helm and dashboard registration

## License

Apache-2.0
