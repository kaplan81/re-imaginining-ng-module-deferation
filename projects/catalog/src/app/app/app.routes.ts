import type { Routes } from '@angular/router';

/**
 * Standalone shape of the remote. When `ng serve catalog` runs on :4201 this is
 * the route table; in federated mode the shell loads `catalog.routes.ts`
 * directly and this file is never evaluated.
 *
 * `widgets` is listed first because the `''` route below consumes no segments
 * and would otherwise try to match `widgets` against its own children.
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
    loadChildren: () => import('../catalog/catalog.routes').then((feature) => feature.routes),
  },
];
