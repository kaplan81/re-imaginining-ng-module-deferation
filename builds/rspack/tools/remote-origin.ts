import { rspack, type RspackPluginInstance } from '@rspack/core';

/**
 * Restores `import.meta.url` for the "Rendered by …" strip.
 *
 * Every application in this workspace ships its own `remote-origin.component`,
 * which reads `new URL(import.meta.url).origin` so the strip names the origin
 * that actually served the component - :4211 when the shell mounted the catalog
 * remote, not the shell's own :4210. Under the Angular CLI that is just an ES
 * module evaluating in the browser and it is true by construction.
 *
 * Rspack wraps every module in a function, so there is no module URL left to
 * read. Its parser substitutes `import.meta.url` at *build* time with the
 * absolute `file://` path of the source file, which is both wrong (it is the
 * build machine, not the server) and a small information leak - the developer's
 * home directory ends up in a shipped bundle.
 *
 * `__webpack_require__.p` is the bundler's own answer to the same question: with
 * `publicPath: 'auto'` the runtime derives it from the script that loaded the
 * chunk, which is exactly the origin the strip wants. Substituting the
 * *expression* rather than a literal is what keeps the resolution at runtime.
 *
 * The `|| document.baseURI` arm matters more than it looks. `publicPath` is `''`
 * unless it is explicitly `'auto'`, and `new URL('')` throws, so without the
 * fallback the strip silently degrades to "unknown origin" - which is how this
 * was first caught. Every config here sets `publicPath: 'auto'` (federation
 * requires it anyway, or a remote's chunks would be fetched from the host's
 * origin), so the fallback is a belt-and-braces guard rather than the live path.
 *
 * This is a build-pipeline difference the talk should show, not hide: the
 * baseline needs no equivalent, because native ES modules keep their own
 * identity all the way to the browser.
 */
export function remoteOriginPlugin(): RspackPluginInstance {
  return new rspack.DefinePlugin({
    'import.meta.url': '(__webpack_require__.p || document.baseURI)',
  });
}
