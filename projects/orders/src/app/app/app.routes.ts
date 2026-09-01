import type { Routes } from '@angular/router';

/** Standalone shape of the remote; unused when the shell composes it. */
export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('../orders/orders.routes').then((feature) => feature.routes),
  },
];
