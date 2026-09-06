import { createConfig } from '@nx/angular-rspack';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import { join } from 'node:path';

import { remoteOriginPlugin } from '../tools/remote-origin';
import { seamPlugins } from '../tools/seam';
import { sharedDependencies } from '../tools/shared-deps';

const workspaceRoot = join(__dirname, '..', '..', '..');

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
  },

  rspackConfigOverrides: {
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

      /**
       * The only two shell files this pipeline replaces. Everything else under
       * `projects/shell/src` - routes, header, home page, the remote slot, the
       * fallback component - compiles byte for byte from build 1's tree. The
       * build fails if either path stops matching; see `tools/seam.ts`.
       */
      ...seamPlugins(workspaceRoot, [
        {
          original: 'projects/shell/src/app/app/utils/remote/remote.util.ts',
          replacement: 'builds/rspack/shell/src/seam/remote.util.ts',
        },
        {
          original:
            'projects/shell/src/app/app/services/remote-registry/remote-registry.service.ts',
          replacement: 'builds/rspack/shell/src/seam/remote-registry.service.ts',
        },
      ]),

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
