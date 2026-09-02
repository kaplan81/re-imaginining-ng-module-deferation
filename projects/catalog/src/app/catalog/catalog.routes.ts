import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { Routes } from '@angular/router';

import { catalogMockInterceptor } from './interceptors/catalog-mock/catalog-mock.interceptor';
import { CatalogService } from './services/catalog/catalog.service';

/**
 * The remote's contract with the outside world. `federation.config.mjs` exposes
 * this file as `./Routes`; the shell grafts it onto its router without knowing
 * anything about what is inside.
 *
 * Route-level providers are what make that safe. `HttpClient`, the mock backend
 * interceptor and the `CatalogService` are created when a catalog route
 * activates and destroyed when it deactivates. The host never provides them, so
 * the remote behaves identically whether it is federated into the shell or served
 * standalone on :4201.
 */
export const routes: Routes = [
  {
    path: '',
    providers: [provideHttpClient(withInterceptors([catalogMockInterceptor])), CatalogService],
    loadComponent: () =>
      import('./containers/catalog-view/catalog-view.component').then(
        (m) => m.CatalogViewComponent,
      ),
  },
];
