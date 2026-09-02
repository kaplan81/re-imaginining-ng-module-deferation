import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { Routes } from '@angular/router';

import { ordersMockInterceptor } from './interceptors/orders-mock/orders-mock.interceptor';
import { OrdersService } from './services/orders/orders.service';

/**
 * Exposed as `./Routes` by `federation.config.mjs`. Same shape as the catalog
 * remote on purpose: the shell composes both through one code path and needs no
 * per-remote special casing.
 */
export const routes: Routes = [
  {
    path: '',
    providers: [provideHttpClient(withInterceptors([ordersMockInterceptor])), OrdersService],
    loadComponent: () =>
      import('./containers/orders-board/orders-board.component').then(
        (m) => m.OrdersBoardComponent,
      ),
  },
];
