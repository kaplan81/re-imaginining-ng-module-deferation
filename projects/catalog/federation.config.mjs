import { withNativeFederation, shareAll } from '@angular-architects/native-federation/config';

export default withNativeFederation({
  name: 'catalog',

  // The public surface of this remote: a route table, so it owns a whole URL
  // subtree along with its own lazy loading, providers and internal URLs.
  // Component-level composition lives in the widget microfrontends instead -
  // see projects/top-lots and projects/roast-queue.
  exposes: {
    './Routes': './projects/catalog/src/app/catalog/catalog.routes.ts',
  },

  shared: {
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package' },
      {
        overrides: {
          // includeSecondaries opts @angular/core out of ignoreUnusedDeps, so the
          // whole package is shared and shell and remote cannot end up with two
          // different Angular instances on the page.
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
    // Groups chunks in remoteEntry.json to keep the metadata file small.
    denseChunking: true,
  },
});
