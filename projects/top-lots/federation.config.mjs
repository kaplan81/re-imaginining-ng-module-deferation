import { withNativeFederation, shareAll } from '@angular-architects/native-federation/config';

export default withNativeFederation({
  name: 'top-lots',

  // A widget-only microfrontend: it publishes mountable components and no route
  // table at all. There is deliberately no './Routes' here - this application is
  // never navigated to, it is mounted into a slot on a page someone else owns.
  exposes: {
    './Widgets': './projects/top-lots/src/app/top-lots/top-lots.widgets.ts',
  },

  shared: {
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package' },
      {
        overrides: {
          '@angular/core': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            build: 'package',
            includeSecondaries: { keepAll: true },
          },
        },
      },
    ),
  },

  skip: ['rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket'],

  features: {
    denseChunking: true,
  },
});
