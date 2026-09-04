import type { Routes } from '@angular/router';

/**
 * Standalone shape of the remote. When `ng serve orders` runs this is the route
 * table; in federated mode the shell loads `orders.routes.ts` directly and this
 * file is never evaluated.
 */
export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('../orders/orders.routes').then((feature) => feature.routes),
  },
];
