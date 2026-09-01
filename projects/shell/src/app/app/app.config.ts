import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';

/**
 * Note what is *not* here: no `provideHttpClient`. The shell never talks to a
 * backend, so remotes cannot accidentally inherit an interceptor chain, a base
 * URL or an auth token from the host. Each remote provides its own HTTP stack in
 * its route providers.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
  ],
};
