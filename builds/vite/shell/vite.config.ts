import angular from '@analogjs/vite-plugin-angular';
import { federation } from '@module-federation/vite';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

import { workspaceAliases } from '../tools/aliases.ts';
import { seamPlugin } from '../tools/seam.ts';
import { optimizeDepsInclude, sharedDependencies } from '../tools/shared-deps.ts';

/**
 * The host, compiled by Vite and composing four remotes over classic Module
 * Federation.
 */
export default defineConfig({
  plugins: [
    /**
     * The only two shell files this pipeline replaces. Everything else under
     * `projects/shell/src` - routes, header, home page, the remote slot, the
     * fallback component - compiles byte for byte from build 1's tree. The
     * build fails if either path stops matching; see `tools/seam.ts`.
     */
    seamPlugin([
      {
        original: 'projects/shell/src/app/app/utils/remote/remote.util.ts',
        replacement: 'builds/vite/shell/src/seam/remote.util.ts',
      },
      {
        original: 'projects/shell/src/app/app/services/remote-registry/remote-registry.service.ts',
        replacement: 'builds/vite/shell/src/seam/remote-registry.service.ts',
      },
    ]),

    angular({
      tsconfig: resolve(import.meta.dirname, 'tsconfig.json'),
      inlineStylesExtension: 'scss',

      // Angular component HMR. Without it every save is a full page reload,
      // where the Angular CLI hot-swaps the component - a DX gap big enough to
      // be worth the one caveat it carries: after the first update Analog serves
      // component styles as external `<link>` URLs instead of inlining them, so
      // in *dev* a federated component's CSS is fetched from its own origin
      // rather than travelling with the module. Dev only; the build output still
      // inlines, which is what keeps `styles.scss` unnecessary across the
      // federation boundary.
      liveReload: true,
    }),

    federation({
      name: 'shell',
      filename: 'remoteEntry.js',

      // Deliberately empty. Remote URLs are read from the deployed
      // `federation.manifest.json` asset and registered at runtime in
      // `src/main.ts`, so adding a widget microfrontend stays two JSON edits
      // and a deploy - as in build 1, and unlike the idiomatic
      // `@module-federation/vite` setup, which compiles both the URLs and the
      // remote names into this bundle.
      remotes: {},

      shared: sharedDependencies(),

      // Default is 'html', which injects the host's federation init as an eager
      // <script>/<link rel=modulepreload> in index.html - and with it every
      // shared package, before Angular is even asked for. 'entry' moves it into
      // the entry module instead, which `main.ts` already keeps behind an async
      // `import('./bootstrap')`.
      hostInitInjectLocation: 'entry',

      dts: false,
    }),
  ],

  // Vite does not read tsconfig `paths`. See `tools/aliases.ts`.
  resolve: { alias: workspaceAliases() },

  css: {
    preprocessorOptions: {
      scss: { loadPaths: ['../../../projects/shell/styles'] },
    },
  },

  server: { port: 5173, origin: 'http://localhost:5173' },
  preview: { port: 5173 },

  // Pre-bundled up front so Vite cannot discover Angular's secondary entry
  // points mid-load and force a reload. See `tools/shared-deps.ts`.
  optimizeDeps: { include: [...optimizeDepsInclude] },

  // Module Federation's runtime uses top-level `await`, so anything below
  // `es2022` breaks the remote entry before it can report why.
  build: { target: 'es2022' },
});
