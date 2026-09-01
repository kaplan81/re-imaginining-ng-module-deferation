import type { Routes } from '@angular/router';

/**
 * Standalone shape of the remote. When `ng serve catalog` runs on :4201 this is
 * the route table; in federated mode the shell loads `catalog.routes.ts`
 * directly and this file is never evaluated.
 */
export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('../catalog/catalog.routes').then((feature) => feature.routes),
  },
];
