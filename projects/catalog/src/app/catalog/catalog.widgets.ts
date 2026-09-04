import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { EnvironmentProviders, Provider, Type } from '@angular/core';

import { catalogMockInterceptor } from './interceptors/catalog-mock/catalog-mock.interceptor';
import { CatalogService } from './services/catalog/catalog.service';

/**
 * One mountable widget this remote publishes.
 *
 * The shell declares a structurally identical interface of its own - it cannot
 * import this one, because that would be a build-time dependency between two
 * independently deployed applications. Both sides therefore assert the shape and
 * nothing checks that they agree, which is the same unverified contract
 * `./Routes` already has. The standalone gallery on :4201 is the mitigation: it
 * consumes this list inside the catalog's own build, so a broken descriptor
 * fails in catalog's dev server rather than only in the shell.
 */
export interface CatalogWidget {
  /** Stable id the host asks for. Renaming one is a breaking change. */
  id: string;
  label: string;
  /**
   * The second lazy boundary. `./Widgets` carries only this list; the component
   * chunk is fetched by the `import()` below, when and if the host mounts it.
   *
   * `providers` is the same array `Route.providers` carries in `catalog.routes.ts`,
   * so a widget gets its HTTP stack, mock interceptor and `CatalogService` from
   * an injector this remote describes and the host merely instantiates. That is
   * what keeps a component-level contract as safe as the route-level one: the
   * host still decides nothing about what surrounds the component.
   */
  load: () => Promise<{
    component: Type<unknown>;
    /**
     * `Provider | EnvironmentProviders` and not just `Provider`, because
     * `provideHttpClient()` returns the latter - the same union `Route.providers`
     * accepts.
     */
    providers?: readonly (Provider | EnvironmentProviders)[];
  }>;
}

export const widgets: readonly CatalogWidget[] = [
  {
    id: 'top-lots',
    label: 'Top scoring lots',
    load: () =>
      import('./containers/top-lots-widget/top-lots-widget.component').then((m) => ({
        component: m.TopLotsWidgetComponent,
        providers: [provideHttpClient(withInterceptors([catalogMockInterceptor])), CatalogService],
      })),
  },
];
