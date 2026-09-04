import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { EnvironmentProviders, Provider, Type } from '@angular/core';

import { roastQueueMockInterceptor } from './interceptors/roast-queue-mock/roast-queue-mock.interceptor';
import { RoastQueueService } from './services/roast-queue/roast-queue.service';

/**
 * The entire public surface of this microfrontend - `./Widgets` and no
 * `./Routes`. See the note in `top-lots.widgets.ts`: a host declares its own
 * structurally identical interface rather than importing this one, and the
 * gallery at :4204 is what keeps this list honest inside its own build.
 */
export interface RoastQueueWidget {
  id: string;
  label: string;
  load: () => Promise<{
    component: Type<unknown>;
    providers?: readonly (Provider | EnvironmentProviders)[];
  }>;
}

export const widgets: readonly RoastQueueWidget[] = [
  {
    id: 'roast-queue',
    label: 'Roast queue',
    load: () =>
      import('./containers/roast-queue-widget/roast-queue-widget.component').then((m) => ({
        component: m.RoastQueueWidgetComponent,
        providers: [
          provideHttpClient(withInterceptors([roastQueueMockInterceptor])),
          RoastQueueService,
        ],
      })),
  },
];
