import type { Routes } from '@angular/router';

/**
 * Standalone shape of the remote; unused when the shell composes it. `widgets`
 * is listed first because the `''` route consumes no segments and would
 * otherwise try to match `widgets` against its own children.
 */
export const routes: Routes = [
  {
    path: 'widgets',
    loadComponent: () =>
      import('./containers/widget-gallery/widget-gallery.component').then(
        (m) => m.WidgetGalleryComponent,
      ),
  },
  {
    path: '',
    loadChildren: () => import('../orders/orders.routes').then((feature) => feature.routes),
  },
];
