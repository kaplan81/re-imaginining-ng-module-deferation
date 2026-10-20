import { withNativeFederation, shareAll } from '@angular-architects/native-federation/config';

// Every top-level @angular/* package opts out of entrypoint pruning. Orchestrator
// >= 4.8 no longer stitches a package together from several builds, so a build
// that publishes only the entrypoints it imports makes any remote importing a
// different one fall back to its own Angular instance.
// See https://github.com/orgs/native-federation/discussions/176
const sharedAngular = {
  singleton: true,
  strictVersion: true,
  requiredVersion: 'auto',
  build: 'package',
  includeSecondaries: { keepAll: true },
};

// keepAll publishes every entry point of a package, used or not. These import
// packages this workspace deliberately does not install (@angular/animations,
// @angular/upgrade) or are test-only code with no place in a production bundle.
const skipAngularExtras = [
  '@angular/platform-browser/animations',
  '@angular/platform-browser/animations/async',
  '@angular/platform-browser/testing',
  '@angular/common/upgrade',
  '@angular/common/testing',
  '@angular/common/http/testing',
  '@angular/core/testing',
  '@angular/router/upgrade',
  '@angular/router/testing',
];

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
          '@angular/core': sharedAngular,
          '@angular/common': sharedAngular,
          '@angular/platform-browser': sharedAngular,
          '@angular/router': sharedAngular,
        },
      },
    ),
  },

  skip: ['rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket', ...skipAngularExtras],

  features: {
    denseChunking: true,
    denseExternals: true,
  },
});
