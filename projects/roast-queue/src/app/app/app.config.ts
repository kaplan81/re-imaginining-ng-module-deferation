import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';

/**
 * No `provideRouter` here, and no route table anywhere in this application.
 *
 * A widget-only microfrontend exposes no `./Routes` and is never navigated to,
 * so a router would be pure weight - it pulled `@angular/router` and
 * `@angular/platform-browser` into the standalone bundle as local copies,
 * because the federation share map is derived from what the *exposed* entry
 * point uses and the widget uses neither.
 */
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners()],
};
