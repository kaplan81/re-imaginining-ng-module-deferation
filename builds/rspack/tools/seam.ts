import { rspack, type RspackPluginInstance } from '@rspack/core';
import { resolve } from 'node:path';

const pluginName = 'FederationSeam';

/**
 * Swaps the shell's federation seam, module for module, at bundle time.
 *
 * Criterion 3 of the plan is that the feature code is imported from `projects/*`
 * with zero modifications, so that the pipeline is the only variable. For the
 * two page remotes and the two widget microfrontends that is easy - their
 * exposed entry points touch no federation API at all, so a `paths` alias is
 * enough. The shell is the exception: it is the only application that *calls* a
 * federation runtime, and Native Federation's and Module Federation's runtimes
 * are different APIs.
 *
 * The obvious approach - copy the seam files into this build and let the copies
 * import each other - fails badly. `remote.util.ts` is reached from
 * `app.routes.ts` by a *relative* import, so a copy of the seam drags in a copy
 * of `app.routes.ts`, which drags in `app.config.ts`, which drags in
 * `bootstrap.ts`; and `remote-slot.component.ts` imports the seam relatively
 * too. Six files duplicated in order to change two, and the talk's central claim
 * quietly weakened by every one of them.
 *
 * Substituting below the import graph keeps that claim intact: every other file
 * under `projects/shell/src` compiles from build 1's tree, byte for byte.
 *
 * Why this is hand-rolled rather than `NormalModuleReplacementPlugin`: that
 * plugin is a native builtin whose `resourceRegExp` is matched before the
 * callback can say what it matched against, and whose function form must
 * *return* a new resolve-data object rather than mutate the one it is handed.
 * Both are easy to get subtly wrong, and getting them wrong is silent - the
 * first version of this file did exactly that and shipped build 1's Native
 * Federation calls inside build 2 with a green build. Matching on the
 * `(context, request)` pair instead is unambiguous: these two modules are only
 * ever reached by relative import, so resolving the pair by hand and comparing
 * paths cannot match anything else.
 */
export interface SeamReplacement {
  /** Path of the build-1 module to replace, relative to the workspace root. */
  original: string;
  /** Path of this pipeline's version, relative to the workspace root. */
  replacement: string;
}

export function seamPlugins(
  workspaceRoot: string,
  replacements: readonly SeamReplacement[],
): RspackPluginInstance[] {
  // Keyed without the extension, because that is the shape a TypeScript
  // relative import resolves to: `./utils/remote/remote.util`, no `.ts`.
  const bySpecifier = new Map(
    replacements.map((seam) => [
      stripExtension(resolve(workspaceRoot, seam.original)),
      resolve(workspaceRoot, seam.replacement),
    ]),
  );

  const replace: RspackPluginInstance = {
    apply(compiler) {
      compiler.hooks.normalModuleFactory.tap(pluginName, (factory) => {
        factory.hooks.beforeResolve.tap(pluginName, (data) => {
          if (!data.request.startsWith('.')) {
            return;
          }

          const target = bySpecifier.get(stripExtension(resolve(data.context, data.request)));

          if (target) {
            data.request = target;
          }
        });
      });
    },
  };

  return [replace, assertNoUnreplacedSeam(workspaceRoot, replacements)];
}

/**
 * Turns a mistyped seam path from a silent runtime failure into a build failure
 * that names the file.
 *
 * The check is deliberately *not* "did every replacement fire". The adapter's
 * dev server compiles lazily, so a first compilation legitimately contains none
 * of these modules, and asserting on the callback fails every `rspack serve` on
 * startup - which is what the first version of this did. What is actually wrong
 * is an *unreplaced original* surviving into the module graph, so that is what
 * is asserted: if the substitution fired, the module's resource is the
 * replacement and the original is absent; if it did not, the original is sitting
 * right there in `compilation.modules`.
 */
function assertNoUnreplacedSeam(
  workspaceRoot: string,
  replacements: readonly SeamReplacement[],
): RspackPluginInstance {
  const originals = new Map(
    replacements.map((seam) => [resolve(workspaceRoot, seam.original), seam.original]),
  );

  return {
    apply(compiler) {
      compiler.hooks.afterCompile.tap(`${pluginName}Assert`, (compilation) => {
        for (const module of compilation.modules) {
          const resource = (module as { resource?: string }).resource;
          const seam = resource ? originals.get(resource) : undefined;

          if (seam) {
            compilation.errors.push(
              new rspack.WebpackError(
                `[seam] "${seam}" reached the bundle unreplaced.\n` +
                  `Build 1's federation runtime calls would ship inside build 2. ` +
                  `The path in the shell's rspack.config.ts no longer matches the file.`,
              ),
            );
          }
        }
      });
    },
  };
}

function stripExtension(path: string): string {
  return path.replace(/\.[cm]?tsx?$/, '');
}
