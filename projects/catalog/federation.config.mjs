import { withNativeFederation, shareAll } from '@angular-architects/native-federation/config';

export default withNativeFederation({
  name: 'catalog',

  // The one and only public surface of this remote. Exposing the route table
  // rather than a component keeps the remote in charge of its own lazy loading,
  // its own providers and its own internal URLs.
  exposes: {
    './Routes': './projects/catalog/src/app/catalog/catalog.routes.ts',
    './Widgets': './projects/catalog/src/app/catalog/catalog.widgets.ts',
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
