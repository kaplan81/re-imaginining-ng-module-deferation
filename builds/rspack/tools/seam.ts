import { rspack, type RspackPluginInstance } from '@rspack/core';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';

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
  const fired = new Set<string>();

  const plugins: RspackPluginInstance[] = replacements.map((seam) => {
    const original = resolve(workspaceRoot, seam.original);
    const replacement = resolve(workspaceRoot, seam.replacement);

    // Checked here, not assumed - see `assertEverySeamFired` for why a wrong
    // path is the failure this whole guard exists to catch.
    for (const [label, path] of [
      ['original', original],
      ['replacement', replacement],
    ] as const) {
      if (!existsSync(path)) {
        throw new Error(
          `[seam] the ${label} "${relative(workspaceRoot, path)}" does not exist. ` +
            `Fix the path in the shell's rspack.config.ts.`,
        );
      }
    }

    return {
      apply(compiler) {
        compiler.hooks.normalModuleFactory.tap(pluginName, (factory) => {
          factory.hooks.beforeResolve.tap(pluginName, (data) => {
            if (!data.request.startsWith('.')) {
              return;
            }

            if (stripExtension(resolve(data.context, data.request)) === stripExtension(original)) {
              fired.add(seam.original);
              data.request = replacement;
            }
          });
        });
      },
    };
  });

  return [...plugins, assertEverySeamFired(replacements, fired)];
}

/**
 * Fails the build unless every seam was actually substituted.
 *
 * This is the second version of this check, and the first one was wrong in a way
 * worth putting on a slide.
 *
 * Version one asked "did an *unreplaced original* reach `compilation.modules`?"
 * That caught the bug it was written for - a substitution that silently did
 * nothing - but the reasoning is circular, and it misses the more likely
 * failure. When the configured path is wrong there is nothing left to compare
 * against: the redirect never matches, the real file compiles normally under its
 * real name, the search for the *misspelled* name finds nothing, and the build
 * goes green with build 1's Native Federation calls inside build 2. Confirmed by
 * misspelling the path in build 3, which had the identical hole -
 * `Federation runtime is not ready: initFederation() has not resolved yet` was
 * sitting in the output bundle of a build that reported no errors.
 *
 * Version two asserts the positive: every configured seam must have fired.
 * Paired with the `existsSync` check above, a mistyped path now fails twice
 * before it can reach a bundle.
 *
 * `afterEmit` rather than `afterCompile`, because the dev server compiles lazily
 * and an early compilation legitimately contains neither seam; by emit time the
 * entry graph has been walked.
 */
function assertEverySeamFired(
  replacements: readonly SeamReplacement[],
  fired: ReadonlySet<string>,
): RspackPluginInstance {
  return {
    apply(compiler) {
      compiler.hooks.afterEmit.tap(`${pluginName}Assert`, (compilation) => {
        const missed = replacements.filter((seam) => !fired.has(seam.original));

        if (missed.length > 0) {
          compilation.errors.push(
            new rspack.WebpackError(
              `[seam] ${missed.length} of ${replacements.length} seam modules were never substituted:\n` +
                missed.map((seam) => `  - ${seam.original}`).join('\n') +
                `\nBuild 1's federation runtime calls would ship inside build 2.`,
            ),
          );
        }
      });
    },
  };
}

function stripExtension(path: string): string {
  return path.replace(/\.[cm]?tsx?$/, '');
}
