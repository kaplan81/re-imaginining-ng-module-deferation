import angular from '@analogjs/vite-plugin-angular';
import { federation } from '@module-federation/vite';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

import { workspaceAliases } from '../tools/aliases.ts';
import { optimizeDepsInclude, sharedDependencies } from '../tools/shared-deps.ts';

/**
 * The `top-lots` remote, compiled by Vite and exposed over classic Module
 * Federation.
 *
 * A **widget microfrontend**: it exposes only `./Widgets` and has no route table
 * at all, so it is never navigated to - a host mounts it into a slot on a page
 * the host owns. `<remote>.widgets.ts` is plain `@angular/core` with no
 * federation API anywhere in it, which is why it has now crossed to two
 * different federation runtimes and two different bundlers without an edit.
 */
export default defineConfig({
  plugins: [
    angular({
      // Analog looks for `tsconfig.app.json` by default and only *warns* when it
      // is missing - then compiles without it, which would silently drop
      // `strictTemplates` and the rest of `angularCompilerOptions`.
      tsconfig: resolve(import.meta.dirname, 'tsconfig.json'),

      // Component `styles:` blocks in this workspace are SCSS and start with
      // `@use 'tokens'`. Without this they are parsed as plain CSS.
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
      name: 'top-lots',
      filename: 'remoteEntry.js',

      // The alias resolves into `projects/top-lots/src/app/top-lots/` - the same
      // unmodified file build 1 exposes. The exposed key is identical on all
      // three pipelines, so the *contract* is pipeline-independent even though
      // the mechanism is not.
      exposes: {
        './Widgets': '@rr/top-lots/top-lots.widgets',
      },

      // No router in a widget microfrontend, so sharing one would only emit a
      // fallback copy of a package this application can never import.
      shared: sharedDependencies({ omit: ['@angular/router'] }),

      // Emits `mf-manifest.json` beside `remoteEntry.js` - this pipeline's
      // answer to Native Federation's `remoteEntry.json`: metadata a host can
      // read before executing anything.
      manifest: true,
      dts: false,
    }),
  ],

  // Vite does not read tsconfig `paths`. See `tools/aliases.ts`.
  resolve: { alias: workspaceAliases() },

  // Vite has no `stylePreprocessorOptions`. `loadPaths` is the Sass-level
  // equivalent, and it points at this project's *own* `styles/` folder - the
  // five copies stay independent, exactly as in build 1.
  css: {
    preprocessorOptions: {
      scss: { loadPaths: ['../../../projects/top-lots/styles'] },
    },
  },

  server: {
    port: 5176,

    // Without an absolute `origin`, dev-mode asset URLs are relative, so a host
    // on :5173 resolves this remote's lazy chunks against *its own* origin and
    // 404s. The build output has the same requirement, met by `base` below.
    origin: 'http://localhost:5176',
  },

  preview: { port: 5176 },

  // The build-time counterpart of `server.origin`: a remote's chunks must be
  // fetched from the remote, not from whoever mounted it.
  base: 'http://localhost:5176/',

  // Pre-bundled up front so Vite cannot discover Angular's secondary entry
  // points mid-load and force a reload. See `tools/shared-deps.ts`.
  optimizeDeps: { include: [...optimizeDepsInclude] },

  // Module Federation's runtime uses top-level `await`, so anything below
  // `es2022` breaks the remote entry before it can report why.
  build: { target: 'es2022' },
});
