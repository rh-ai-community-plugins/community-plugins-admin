import {
  communityPluginsAdminAreaExtension,
  communityPluginsSectionExtension,
  communityPluginsAdminSectionExtension,
  catalogNavExtension,
  installedNavExtension,
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
    it('should define Catalog nav item under community-plugins-admin section', () => {
      expect(catalogNavExtension.type).toBe('app.navigation/href');
      expect(catalogNavExtension.properties.id).toBe('community-plugins-admin-catalog');
      expect(catalogNavExtension.properties.title).toBe('Catalog');
      expect(catalogNavExtension.properties.href).toBe('/community-plugins-admin/catalog');
      expect(catalogNavExtension.properties.section).toBe('community-plugins-admin');
      expect(catalogNavExtension.properties.path).toBe('/community-plugins-admin/catalog/*');
    });

    it('should define Installed nav item under community-plugins-admin section', () => {
      expect(installedNavExtension.type).toBe('app.navigation/href');
      expect(installedNavExtension.properties.id).toBe('community-plugins-admin-installed');
      expect(installedNavExtension.properties.title).toBe('Installed');
      expect(installedNavExtension.properties.href).toBe('/community-plugins-admin/installed');
      expect(installedNavExtension.properties.section).toBe('community-plugins-admin');
      expect(installedNavExtension.properties.path).toBe('/community-plugins-admin/installed/*');
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
    it('should contain all six extensions', () => {
      expect(extensions).toHaveLength(6);
    });

    it('should include all extensions in the correct order', () => {
      expect(extensions).toEqual([
        communityPluginsSectionExtension,
        communityPluginsAdminAreaExtension,
        communityPluginsAdminSectionExtension,
        catalogNavExtension,
        installedNavExtension,
        communityPluginsAdminRouteExtension,
      ]);
    });
  });
});
