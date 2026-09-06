import { createConfig } from '@nx/angular-rspack';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';

import { moduleScriptTagsPlugin } from '../tools/module-script-tags';
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
    // `hmr: false` is load-bearing, and the reason is federation-specific.
    //
    // In dev, Rspack injects its HMR client into this remote's own bundle - and
    // therefore into the container the *host* loads. Mounted into the shell, that
    // client keeps polling **this** origin for `<name>.<hash>.hot-update.json`,
    // using the compilation hash it was built with. The dev server prunes update
    // files for older hashes, so as soon as this remote rebuilds once the fetch
    // 404s, the client decides it cannot patch and calls for a full reload - of
    // the *shell's* page, not this one. The shell reloads, re-fetches this
    // container, gets the same stale hash, and the whole thing repeats forever.
    //
    // Live reload stays on: it has no hash to go stale, and it is what makes
    // editing a remote refresh the host page, which is the DX you actually want
    // across a federation boundary. Only hot-module *patching* is disabled, and
    // it could never have worked across the boundary anyway - the host holds
    // module instances the remote's HMR runtime cannot reach.
    devServer: { port: 4212, hmr: false, liveReload: false },
  },

  rspackConfigOverrides: {
    // Required once federation is in play: without it a remote's lazy chunks are
    // fetched from the *host's* origin and 404.
    // `'auto'` makes the runtime derive the base URL from the script that
    // loaded the chunk. Required once federation is in play - without it a
    // remote's lazy chunks are fetched from the *host's* origin and 404 - and
    // it is also what keeps the "Rendered by" strip honest, since it reports a
    // value derived at runtime rather than one compiled in.
    output: { publicPath: 'auto' },

    // Rspack's CLI turns on `lazyCompilation: { imports: true, entries: false }`
    // by default for `rspack serve`, and it is silently fatal across a federation
    // boundary. Every dynamic `import()` becomes a stub that first POSTs to
    // `/_rspack/lazy/trigger…` to have the real chunk compiled - resolved against
    // *the origin of the page it runs in*. A remote's second lazy level (a
    // route's `loadComponent`, a widget descriptor's `load()`) executes inside
    // the **host's** page, so the trigger goes to the host's dev server, which
    // knows nothing about this compilation. The chunk is never built, the
    // `import()` promise never settles, and the router renders an empty outlet -
    // no error, no fallback, nothing to search for.
    //
    // Worth a slide: it only misbehaves in dev, only when federated, and it
    // fails by hanging rather than by throwing.
    lazyCompilation: false,

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
      moduleScriptTagsPlugin(),

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
