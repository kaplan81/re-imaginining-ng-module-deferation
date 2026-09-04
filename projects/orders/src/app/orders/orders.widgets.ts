import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { EnvironmentProviders, Provider, Type } from '@angular/core';

import { ordersMockInterceptor } from './interceptors/orders-mock/orders-mock.interceptor';
import { OrdersService } from './services/orders/orders.service';

/** See the note in `catalog/catalog.widgets.ts` - the shape is duplicated on purpose. */
export interface OrdersWidget {
  id: string;
  label: string;
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

export const widgets: readonly OrdersWidget[] = [
  {
    id: 'roast-queue',
    label: 'Roast queue',
    load: () =>
      import('./containers/roast-queue-widget/roast-queue-widget.component').then((m) => ({
        component: m.RoastQueueWidgetComponent,
        providers: [provideHttpClient(withInterceptors([ordersMockInterceptor])), OrdersService],
      })),
  },
];
