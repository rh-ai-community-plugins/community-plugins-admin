import { resolveInstallState, mfKebab } from '../installState';

describe('mfKebab', () => {
  it('prefers the declared MF scope over the registry name', () => {
    expect(
      mfKebab({
        name: 'gpu-booking-plugin',
        remote: { type: 'module-federation', spec: { name: 'gpuBooking', scope: 'gpuBooking' } },
      }),
    ).toBe('gpu-booking');
  });

  it('falls back to the registry name when no MF scope is declared', () => {
    expect(mfKebab({ name: 'brewet' })).toBe('brewet');
    expect(mfKebab({ name: 'brewet', remote: { type: 'module-federation' } })).toBe('brewet');
  });

  it('uses scope when name is absent from the remote spec', () => {
    expect(
      mfKebab({ name: 'my-plugin', remote: { type: 'module-federation', spec: { scope: 'myPlugin' } } }),
    ).toBe('my-plugin');
  });
});

describe('resolveInstallState', () => {
  const gpuBooking = {
    name: 'gpu-booking-plugin',
    remote: { type: 'module-federation', spec: { name: 'gpuBooking', scope: 'gpuBooking' } },
  };

  it('reports installed when the MF-scope name is in the installed set (registry name drifts)', () => {
    const state = resolveInstallState(gpuBooking, {
      installedNames: new Set(['gpu-booking']),
      helmInstalledNames: new Set(['gpu-booking-plugin']),
    });
    expect(state.installed).toBe(true);
    expect(state.disabled).toBe(false);
  });

  it('reports installed when the registry name matches directly (no drift)', () => {
    const state = resolveInstallState({ name: 'brewet' }, {
      installedNames: new Set(['brewet']),
      helmInstalledNames: new Set(['brewet']),
    });
    expect(state.installed).toBe(true);
    expect(state.disabled).toBe(false);
  });

  it('reports disabled when a Helm release exists but the plugin is not registered', () => {
    const state = resolveInstallState(gpuBooking, {
      installedNames: new Set(),
      helmInstalledNames: new Set(['gpu-booking-plugin']),
    });
    expect(state.installed).toBe(false);
    expect(state.disabled).toBe(true);
  });

  it('reports available when neither set contains the plugin', () => {
    const state = resolveInstallState(gpuBooking, {
      installedNames: new Set(['something-else']),
      helmInstalledNames: new Set(['other-release']),
    });
    expect(state.installed).toBe(false);
    expect(state.disabled).toBe(false);
  });
});
