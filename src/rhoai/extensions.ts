// [SHARED] Common section for all community plugins — never changes across plugins.
// Do not change the id or name: all community plugins share this section
// so they appear grouped together in the dashboard sidebar.
export const communityPluginsSectionExtension = {
  type: 'app.navigation/section' as const,
  properties: {
    id: 'community-plugins', // [SHARED] common section for all community plugins
    title: 'Community plugins', // [SHARED]
    group: '9_plugins', // [SHARED]
    iconRef: () => import(/* webpackMode: "eager" */ './CommunityNavIcon'),
  },
};

// [PLUGIN-SPECIFIC] Everything below is specific to this plugin

export const communityPluginsAdminAreaExtension = {
  type: 'app.area' as const,
  properties: {
    id: 'community-plugins-admin', // [PLUGIN-SPECIFIC] unique area ID
    featureFlags: [] as string[],
  },
};

export const communityPluginsAdminSectionExtension = {
  type: 'app.navigation/section' as const,
  properties: {
    id: 'community-plugins-admin', // [PLUGIN-SPECIFIC] unique nav section ID
    title: 'Community Plugins Admin', // [PLUGIN-SPECIFIC] display name in sidebar
    group: '1_community_plugins_admin', // [PLUGIN-SPECIFIC] sort key within community-plugins
    section: 'community-plugins', // [SHARED] must match communityPluginsSectionExtension.id — do not change
    iconRef: () => import(/* webpackMode: "eager" */ '~/app/components/CommunityPluginsAdminNavIcon'),
  },
};

export const catalogNavExtension = {
  type: 'app.navigation/href' as const,
  properties: {
    id: 'community-plugins-admin-catalog', // [PLUGIN-SPECIFIC] unique nav item ID
    title: 'Catalog',
    href: '/community-plugins-admin/catalog', // [PLUGIN-SPECIFIC] must match route prefix
    section: 'community-plugins-admin', // [PLUGIN-SPECIFIC] references this plugin's section ID
    path: '/community-plugins-admin/catalog/*', // [PLUGIN-SPECIFIC] route-matching pattern
  },
};

export const installedNavExtension = {
  type: 'app.navigation/href' as const,
  properties: {
    id: 'community-plugins-admin-installed', // [PLUGIN-SPECIFIC] unique nav item ID
    title: 'Installed',
    href: '/community-plugins-admin/installed', // [PLUGIN-SPECIFIC] must match route prefix
    section: 'community-plugins-admin', // [PLUGIN-SPECIFIC] references this plugin's section ID
    path: '/community-plugins-admin/installed/*', // [PLUGIN-SPECIFIC] route-matching pattern
  },
};

export const communityPluginsAdminRouteExtension = {
  type: 'app.route' as const,
  properties: {
    path: '/community-plugins-admin/*', // [PLUGIN-SPECIFIC] top-level route prefix
    component: () => import(/* webpackMode: "eager" */ '~/app/App'),
  },
};

export const extensions = [
  communityPluginsSectionExtension,
  communityPluginsAdminAreaExtension,
  communityPluginsAdminSectionExtension,
  catalogNavExtension,
  installedNavExtension,
  communityPluginsAdminRouteExtension,
];

export default extensions;
