import type { Routes } from '@angular/router';

import { loadRemoteRoutes } from './utils/remote/remote.util';

/**
 * Composition happens here and nowhere else. The two `loadChildren` entries are
 * the only link between the shell and its remotes: no imports, no shared types,
 * no build-time reference. Whatever the remote's route table contains is grafted
 * onto the shell router at navigation time.
 */
export const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('../home/home.routes').then((feature) => feature.routes),
  },
  {
    path: 'catalog',
    loadChildren: () => loadRemoteRoutes('catalog'),
  },
  {
    path: 'orders',
    loadChildren: () => loadRemoteRoutes('orders'),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
