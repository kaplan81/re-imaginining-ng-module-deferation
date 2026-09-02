import type { Route, Routes } from '@angular/router';

import { RemoteUnavailableComponent } from './containers/remote-unavailable/remote-unavailable.component';
import { routes } from './app.routes';

function routeFor(path: string): Route {
  const route = routes.find((candidate) => candidate.path === path);

  if (!route) {
    throw new Error(`No route registered for "${path}"`);
  }

  return route;
}

describe('shell routes', () => {
  it('should expose one path per remote plus home', () => {
    expect(routes.map((route) => route.path)).toEqual(['home', 'catalog', 'orders', '', '**']);
  });

  it('should lazy-load every feature rather than eagerly referencing components', () => {
    for (const path of ['home', 'catalog', 'orders']) {
      const route = routeFor(path);

      expect(route.loadChildren).toBeTypeOf('function');
      expect(route.component).toBeUndefined();
    }
  });

  it('should redirect the empty path to home', () => {
    const route = routeFor('');

    expect(route.pathMatch).toBe('full');
    expect(route.redirectTo).toBe('home');
  });

  it('should send unknown paths to home', () => {
    expect(routeFor('**').redirectTo).toBe('home');
  });

  describe('remote loading', () => {
    // The federation runtime is never initialised in a unit test, so
    // `loadRemoteRoutes` takes exactly the path a down remote takes in production.
    for (const remote of ['catalog', 'orders'] as const) {
      it(`should fall back to an in-shell explanation when ${remote} cannot be loaded`, async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const loaded = (await routeFor(remote).loadChildren!()) as Routes;

        expect(loaded).toHaveLength(1);
        expect(loaded[0].component).toBe(RemoteUnavailableComponent);
        expect(loaded[0].data).toEqual({ remote });
        expect(error).toHaveBeenCalled();

        error.mockRestore();
      });
    }
  });
});
