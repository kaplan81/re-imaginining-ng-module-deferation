import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/home/home.component').then((m) => m.HomeComponent),
  },
];
