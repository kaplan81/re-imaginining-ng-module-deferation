import { rspack, type RspackPluginInstance } from '@rspack/core';

const pluginName = 'ModuleScriptTags';

/**
 * Marks every emitted `<script>` in `index.html` as `type="module"`.
 *
 * `library: { type: 'module' }` on the remotes' container makes the whole
 * compilation ESM, and with `publicPath: 'auto'` Rspack's automatic-publicPath
 * runtime derives the base URL from `import.meta.url`. That is correct ESM - but
 * the adapter decides per entry point whether a script tag is a module, and
 * `getEntryPoints` hardcodes the global-styles entry as *not* one:
 *
 *   ...globalStyles.filter((s) => s.initial).map((s) => [s.name, false]),
 *
 * So `styles.js` ships ESM inside a classic `<script>`, and every dev page load
 * of every application throws:
 *
 *   styles.js: Uncaught SyntaxError: Cannot use 'import.meta' outside a module
 *
 * Nothing breaks visually - the CSS arrives through an inlined critical block and
 * a `<link>`, and `main.js` is tagged correctly - so it is pure console noise,
 * which is exactly the kind of thing that survives until someone opens devtools
 * in front of an audience. Production never shows it, because the adapter strips
 * the JS shim for CSS-only chunks and no styles tag is emitted at all.
 *
 * Rewriting the tag fixes the actual defect - ESM content declared as a classic
 * script - rather than working around it. The alternatives were worse: pinning an
 * explicit `publicPath` per application removes the `import.meta.url` but makes
 * the origin strip report a compiled-in constant instead of a runtime-derived
 * value, and moving global styles into `bootstrap.ts` would change how CSS is
 * delivered and therefore the byte measurements the talk compares.
 *
 * Deliberately not asserted. Unlike the federation seam, a missed rewrite here is
 * cosmetic, and the adapter fixing `getEntryPoints` upstream should quietly make
 * this a no-op rather than fail anyone's build.
 */
export function moduleScriptTagsPlugin(): RspackPluginInstance {
  return {
    apply(compiler) {
      compiler.hooks.compilation.tap(pluginName, (compilation) => {
        compilation.hooks.processAssets.tap(
          { name: pluginName, stage: rspack.Compilation.PROCESS_ASSETS_STAGE_REPORT },
          (assets) => {
            for (const name of Object.keys(assets)) {
              if (!name.endsWith('.html')) {
                continue;
              }

              const source = compilation.getAsset(name)?.source.source();
              const html = typeof source === 'string' ? source : source?.toString();

              if (!html) {
                continue;
              }

              // Only tags that have a `src` and no `type` yet - inline scripts and
              // anything already declared stay untouched.
              const patched = html.replace(
                /<script(?![^>]*\stype=)([^>]*\ssrc="[^"]*"[^>]*)>/g,
                '<script type="module"$1>',
              );

              if (patched !== html) {
                compilation.updateAsset(name, new rspack.sources.RawSource(patched));
              }
            }
          },
        );
      });
    },
  };
}
