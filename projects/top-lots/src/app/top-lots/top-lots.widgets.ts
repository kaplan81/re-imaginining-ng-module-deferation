import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { EnvironmentProviders, Provider, Type } from '@angular/core';

import { topLotsMockInterceptor } from './interceptors/top-lots-mock/top-lots-mock.interceptor';
import { TopLotsService } from './services/top-lots/top-lots.service';

/**
 * The entire public surface of this microfrontend. `federation.config.mjs`
 * exposes this file as `./Widgets`, and there is no `./Routes` at all - nothing
 * here is navigable.
 *
 * A host declares its own structurally identical interface rather than importing
 * this one, because importing it would be a build-time dependency between
 * independently deployed applications. Both sides assert the shape; nothing
 * verifies they still agree. The gallery at :4203 is the mitigation - it consumes
 * this list inside this application's own build, so a broken descriptor fails
 * here rather than only in someone else's page.
 */
export interface TopLotsWidget {
  /** Stable id a host asks for. Renaming one is a breaking change. */
  id: string;
  label: string;
  /**
   * The second lazy boundary. `./Widgets` carries only this list; the component
   * chunk is fetched by the `import()` below, when and if a host mounts it.
   *
   * `providers` is the array shape `Route.providers` accepts, so the widget gets
   * its HTTP stack, its own mock backend and its service from an injector this
   * application describes and the host merely instantiates. That is what keeps a
   * component-level contract as safe as a route-level one: the host decides
   * nothing about what surrounds the component.
   */
  load: () => Promise<{
    component: Type<unknown>;
    providers?: readonly (Provider | EnvironmentProviders)[];
  }>;
}

export const widgets: readonly TopLotsWidget[] = [
  {
    id: 'top-lots',
    label: 'Top scoring lots',
    load: () =>
      import('./containers/top-lots-widget/top-lots-widget.component').then((m) => ({
        component: m.TopLotsWidgetComponent,
        providers: [provideHttpClient(withInterceptors([topLotsMockInterceptor])), TopLotsService],
      })),
  },
];
