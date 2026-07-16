import {
  communityPluginsAdminAreaExtension,
  communityPluginsSectionExtension,
  communityPluginsAdminSectionExtension,
  userInfoNavExtension,
  clusterResourcesNavExtension,
  namespaceSummaryNavExtension,
  communityPluginsAdminRouteExtension,
  extensions,
} from '../extensions';

describe('RHOAI Plugin Extensions', () => {
  describe('communityPluginsAdminAreaExtension', () => {
    it('should have the correct type and id', () => {
      expect(communityPluginsAdminAreaExtension.type).toBe('app.area');
      expect(communityPluginsAdminAreaExtension.properties.id).toBe('community-plugins-admin');
    });

    it('should have an empty featureFlags array', () => {
      expect(communityPluginsAdminAreaExtension.properties.featureFlags).toEqual([]);
    });
  });

  describe('communityPluginsSectionExtension', () => {
    it('should define the community-plugins section', () => {
      expect(communityPluginsSectionExtension.type).toBe('app.navigation/section');
      expect(communityPluginsSectionExtension.properties.id).toBe('community-plugins');
      expect(communityPluginsSectionExtension.properties.title).toBe('Community plugins');
      expect(communityPluginsSectionExtension.properties.group).toBe('9_plugins');
    });

    it('should have an iconRef function', () => {
      expect(typeof communityPluginsSectionExtension.properties.iconRef).toBe('function');
    });
  });

  describe('communityPluginsAdminSectionExtension', () => {
    it('should define a subsection nested under community-plugins', () => {
      expect(communityPluginsAdminSectionExtension.type).toBe('app.navigation/section');
      expect(communityPluginsAdminSectionExtension.properties.id).toBe('community-plugins-admin');
      expect(communityPluginsAdminSectionExtension.properties.title).toBe('Community Plugins Admin');
      expect(communityPluginsAdminSectionExtension.properties.group).toBe('1_community_plugins_admin');
      expect(communityPluginsAdminSectionExtension.properties.section).toBe('community-plugins');
      expect(typeof communityPluginsAdminSectionExtension.properties.iconRef).toBe('function');
    });
  });

  describe('navigation extensions', () => {
    it('should define User Info nav item under community-plugins-admin section', () => {
      expect(userInfoNavExtension.type).toBe('app.navigation/href');
      expect(userInfoNavExtension.properties.id).toBe('community-plugins-admin-user-info');
      expect(userInfoNavExtension.properties.title).toBe('User Info');
      expect(userInfoNavExtension.properties.href).toBe('/community-plugins-admin/user-info');
      expect(userInfoNavExtension.properties.section).toBe('community-plugins-admin');
      expect(userInfoNavExtension.properties.path).toBe('/community-plugins-admin/user-info/*');
    });

    it('should define Cluster Resources nav item under community-plugins-admin section', () => {
      expect(clusterResourcesNavExtension.type).toBe('app.navigation/href');
      expect(clusterResourcesNavExtension.properties.id).toBe('community-plugins-admin-cluster-resources');
      expect(clusterResourcesNavExtension.properties.title).toBe('Cluster Resources');
      expect(clusterResourcesNavExtension.properties.href).toBe('/community-plugins-admin/cluster-resources');
      expect(clusterResourcesNavExtension.properties.section).toBe('community-plugins-admin');
      expect(clusterResourcesNavExtension.properties.path).toBe('/community-plugins-admin/cluster-resources/*');
    });

    it('should define Namespace Summary nav item under community-plugins-admin section', () => {
      expect(namespaceSummaryNavExtension.type).toBe('app.navigation/href');
      expect(namespaceSummaryNavExtension.properties.id).toBe('community-plugins-admin-namespace-summary');
      expect(namespaceSummaryNavExtension.properties.title).toBe('Namespace Summary');
      expect(namespaceSummaryNavExtension.properties.href).toBe('/community-plugins-admin/namespace-summary');
      expect(namespaceSummaryNavExtension.properties.section).toBe('community-plugins-admin');
      expect(namespaceSummaryNavExtension.properties.path).toBe('/community-plugins-admin/namespace-summary/*');
    });
  });

  describe('route extension', () => {
    it('should define a single wildcard route with lazy component', () => {
      expect(communityPluginsAdminRouteExtension.type).toBe('app.route');
      expect(communityPluginsAdminRouteExtension.properties.path).toBe('/community-plugins-admin/*');
      expect(typeof communityPluginsAdminRouteExtension.properties.component).toBe('function');
      expect(communityPluginsAdminRouteExtension.properties.component()).toBeInstanceOf(Promise);
    });
  });

  describe('extensions array', () => {
    it('should contain all seven extensions', () => {
      expect(extensions).toHaveLength(7);
    });

    it('should include all extensions in the correct order', () => {
      expect(extensions).toEqual([
        communityPluginsSectionExtension,
        communityPluginsAdminAreaExtension,
        communityPluginsAdminSectionExtension,
        userInfoNavExtension,
        clusterResourcesNavExtension,
        namespaceSummaryNavExtension,
        communityPluginsAdminRouteExtension,
      ]);
    });
  });
});
