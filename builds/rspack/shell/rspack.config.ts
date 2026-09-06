import { createConfig } from '@nx/angular-rspack';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import { join } from 'node:path';

import { remoteOriginPlugin } from '../tools/remote-origin';
import { seamFileReplacements, seamPlugins } from '../tools/seam';
import { sharedDependencies } from '../tools/shared-deps';

const workspaceRoot = join(__dirname, '..', '..', '..');

const seams = [
  {
    original: 'projects/shell/src/app/app/utils/remote/remote.util.ts',
    replacement: 'builds/rspack/shell/src/seam/remote.util.ts',
  },
  {
    original: 'projects/shell/src/app/app/services/remote-registry/remote-registry.service.ts',
    replacement: 'builds/rspack/shell/src/seam/remote-registry.service.ts',
  },
] as const;

export default createConfig({
  options: {
    root: __dirname,
    browser: './src/main.ts',
    index: './src/index.html',
    tsConfig: './tsconfig.json',
    styles: ['./src/styles.scss'],
    inlineStyleLanguage: 'scss',
    assets: [{ glob: '**/*', input: './public' }],
    stylePreprocessorOptions: {
      includePaths: ['../../../projects/shell/styles'],
    },
    outputPath: { base: './dist' },
    outputHashing: 'none',
    devServer: { port: 4210 },
    // Angular compiles these two files in place of build 1's Native Federation
    // seam. The bundler plugin below is the same swap for anything that still
    // arrives as a webpack resolve - the compiler no longer always does.
    fileReplacements: seamFileReplacements(workspaceRoot, seams),
  },

  rspackConfigOverrides: {
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

      /**
       * The only two shell files this pipeline replaces. Everything else under
       * `projects/shell/src` - routes, header, home page, the remote slot, the
       * fallback component - compiles byte for byte from build 1's tree. The
       * build fails if either path stops matching; see `tools/seam.ts`.
       */
      ...seamPlugins(workspaceRoot, seams),

      new ModuleFederationPlugin({
        name: 'shell',

        // Deliberately empty. Remote URLs are read from the deployed
        // `federation.manifest.json` asset and registered at runtime in
        // `src/main.ts`, so that adding a widget microfrontend stays two JSON
        // edits and a deploy - exactly as in build 1, and unlike idiomatic
        // Module Federation, which compiles the URLs into this bundle.
        remotes: {},

        // The remotes publish ES-module containers (see any remote's config for
        // why), so the host must load them with `import()` rather than by
        // injecting a classic script.
        remoteType: 'module',

        shared: sharedDependencies(__dirname),
        dts: false,
      }),
    ],
  },
});
