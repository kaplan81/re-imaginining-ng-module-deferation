import { createConfig } from '@nx/angular-rspack';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';

import { remoteOriginPlugin } from '../tools/remote-origin';
import { sharedDependencies } from '../tools/shared-deps';

/**
 * The catalog **page remote**, compiled by Rspack and exposed over classic
 * Module Federation.
 *
 * `createConfig` is the `@nx/angular-rspack` adapter's stand-in for the
 * `@angular/build:application` options block in `angular.json`. Most option
 * names survive the move verbatim - `browser`, `index`, `styles`, `assets`,
 * `stylePreprocessorOptions`, `outputHashing` - which is the adapter earning its
 * keep. It returns a *promise of an array* of Rspack configurations.
 *
 * Note what this remote exposes: `./Routes`, and nothing else. It owns a URL
 * subtree and publishes no widgets - component-level composition lives in the
 * two widget microfrontends, `top-lots` and `roast-queue`.
 */
export default createConfig({
  options: {
    root: __dirname,
    browser: './src/main.ts',
    index: './src/index.html',
    tsConfig: './tsconfig.json',
    styles: ['./src/styles.scss'],
    inlineStyleLanguage: 'scss',

    // The feature code lives in the CLI workspace and its component styles do
    // `@use 'tokens'`. Same option name, same semantics as the CLI.
    stylePreprocessorOptions: {
      includePaths: ['../../../projects/catalog/styles'],
    },

    outputPath: { base: './dist' },
    outputHashing: 'none',
    devServer: { port: 4211 },
  },

  rspackConfigOverrides: {
    // `'auto'` makes the runtime derive the base URL from the script that loaded
    // the chunk. Required once federation is in play - without it a remote's
    // lazy chunks are fetched from the *host's* origin and 404 - and it is also
    // what gives `remoteOriginPlugin` something true to substitute.
    output: { publicPath: 'auto' },

    // The adapter defaults browser builds to `optimization.runtimeChunk: 'single'`,
    // which hoists the Rspack runtime out into `runtime.js`. That is fine for a
    // plain application and fatal for a federation container: `remoteEntry.js`
    // is an entry point a *host* loads on its own, so with the runtime hoisted
    // away it has no `__webpack_require__` and dies on line 3 with
    // `Cannot read properties of undefined (reading 'call')` - a message that
    // names neither federation nor the runtime chunk. Worth showing on a slide:
    // the two defaults are individually reasonable and silently incompatible.
    optimization: { runtimeChunk: false },

    plugins: [
      remoteOriginPlugin(),

      new ModuleFederationPlugin({
        name: 'catalog',
        filename: 'remoteEntry.js',

        // Angular's Rspack adapter emits ESM: it forces `output.module`,
        // `chunkFormat: 'module'` and `scriptType: 'module'` to match what the
        // Angular CLI produces. Module Federation's *default* container is a
        // global `var` injected with a classic `<script>`, and the two cannot be
        // combined: Rspack's automatic-publicPath runtime reads
        // `import.meta.url`, the host injects `remoteEntry.js` as a non-module
        // script, and the browser rejects it with `Cannot use 'import.meta'
        // outside a module` - which names neither federation nor the output
        // format. `type: 'module'` switches the container to an ES module the
        // host loads with a dynamic `import()`.
        //
        // A side effect worth noting: the `var` container requires the remote's
        // name to be a valid JS identifier, so `top-lots` and `roast-queue` fail
        // the build outright. As ES modules there is no global to name and the
        // constraint disappears. The baseline never had it either - there a
        // remote name is only ever a key in `federation.manifest.json`.
        library: { type: 'module' },

        // The alias resolves into `projects/catalog/src/app/catalog/` - the same
        // unmodified file `federation.config.mjs` exposes in build 1. The
        // exposed key is identical on both pipelines, so the *contract* is
        // pipeline-independent even though the mechanism is not.
        exposes: {
          './Routes': '@rr/catalog/catalog.routes',
        },

        shared: sharedDependencies(__dirname),

        // Emits `mf-manifest.json` alongside `remoteEntry.js`. The manifest is
        // this pipeline's answer to Native Federation's `remoteEntry.json`:
        // metadata a host can read *before* executing anything.
        manifest: true,
        dts: false,
      }),
    ],
  },
});
