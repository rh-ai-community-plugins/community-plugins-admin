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

export const userInfoNavExtension = {
  type: 'app.navigation/href' as const,
  properties: {
    id: 'community-plugins-admin-user-info', // [PLUGIN-SPECIFIC] unique nav item ID
    title: 'User Info',
    href: '/community-plugins-admin/user-info', // [PLUGIN-SPECIFIC] must match route prefix
    section: 'community-plugins-admin', // [PLUGIN-SPECIFIC] references this plugin's section ID
    path: '/community-plugins-admin/user-info/*', // [PLUGIN-SPECIFIC] route-matching pattern
  },
};

export const clusterResourcesNavExtension = {
  type: 'app.navigation/href' as const,
  properties: {
    id: 'community-plugins-admin-cluster-resources', // [PLUGIN-SPECIFIC] unique nav item ID
    title: 'Cluster Resources',
    href: '/community-plugins-admin/cluster-resources', // [PLUGIN-SPECIFIC] must match route prefix
    section: 'community-plugins-admin', // [PLUGIN-SPECIFIC] references this plugin's section ID
    path: '/community-plugins-admin/cluster-resources/*', // [PLUGIN-SPECIFIC] route-matching pattern
  },
};

export const namespaceSummaryNavExtension = {
  type: 'app.navigation/href' as const,
  properties: {
    id: 'community-plugins-admin-namespace-summary', // [PLUGIN-SPECIFIC] unique nav item ID
    title: 'Namespace Summary',
    href: '/community-plugins-admin/namespace-summary', // [PLUGIN-SPECIFIC] must match route prefix
    section: 'community-plugins-admin', // [PLUGIN-SPECIFIC] references this plugin's section ID
    path: '/community-plugins-admin/namespace-summary/*', // [PLUGIN-SPECIFIC] route-matching pattern
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
  userInfoNavExtension,
  clusterResourcesNavExtension,
  namespaceSummaryNavExtension,
  communityPluginsAdminRouteExtension,
];

export default extensions;
