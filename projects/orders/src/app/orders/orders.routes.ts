import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { Routes } from '@angular/router';

import { ordersMockInterceptor } from './interceptors/orders-mock/orders-mock.interceptor';
import { Orders } from './services/orders/orders';

/**
 * Exposed as `./Routes` by `federation.config.mjs`. Same shape as the catalog
 * remote on purpose: the shell composes both through one code path and needs no
 * per-remote special casing.
 */
export const routes: Routes = [
  {
    path: '',
    providers: [provideHttpClient(withInterceptors([ordersMockInterceptor])), Orders],
    loadComponent: () =>
      import('./containers/orders-board/orders-board').then((m) => m.OrdersBoard),
  },
];
