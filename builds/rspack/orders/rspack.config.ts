import { createConfig } from '@nx/angular-rspack';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';

import { remoteOriginPlugin } from '../tools/remote-origin';
import { sharedDependencies } from '../tools/shared-deps';

/**
 * The `orders` remote, compiled by Rspack and exposed over classic Module
 * Federation.
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
    stylePreprocessorOptions: {
      includePaths: ['../../../projects/orders/styles'],
    },
    outputPath: { base: './dist' },
    outputHashing: 'none',
    devServer: { port: 4212 },
  },

  rspackConfigOverrides: {
    // Required once federation is in play: without it a remote's lazy chunks are
    // fetched from the *host's* origin and 404.
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
        name: 'orders',
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
        exposes: {
          './Routes': '@rr/orders/orders.routes',
        },
        shared: sharedDependencies(__dirname),
        manifest: true,
        dts: false,
      }),
    ],
  },
});
