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
 * Federation calls inside build 2 with a green build.
 *
 * `@nx/angular-rspack` now feeds the Angular compiler already-resolved absolute
 * paths (and sometimes `?ngResource` queries). Matching only `request.startsWith
 * ('.')` therefore never fires, even though the files exist. The matcher below
 * accepts relative *or* absolute requests and also rewrites `afterResolve` once
 * the resource path is known.
 */
export interface SeamReplacement {
  /** Path of the build-1 module to replace, relative to the workspace root. */
  original: string;
  /** Path of this pipeline's version, relative to the workspace root. */
  replacement: string;
}

/** Angular `fileReplacements` entries for the same seams - resolved against `root`. */
export function seamFileReplacements(
  workspaceRoot: string,
  replacements: readonly SeamReplacement[],
): { replace: string; with: string }[] {
  return replacements.map((seam) => ({
    replace: resolve(workspaceRoot, seam.original),
    with: resolve(workspaceRoot, seam.replacement),
  }));
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

    const originalId = normalizePath(original);

    return {
      apply(compiler) {
        compiler.hooks.normalModuleFactory.tap(pluginName, (factory) => {
          factory.hooks.beforeResolve.tap(pluginName, (data) => {
            if (normalizeRequest(data.context, data.request) === originalId) {
              fired.add(seam.original);
              data.request = replacement;
            }
          });

          factory.hooks.afterResolve.tap(pluginName, (data) => {
            const resource = resolveResource(data);

            if (resource !== undefined && normalizePath(resource) === originalId) {
              fired.add(seam.original);
              data.request = replacement;
              const created = createdModule(data);

              if (created !== undefined) {
                created.resource = replacement;
                created.userRequest = replacement;
              }
            }
          });
        });
      },
    };
  });

  return [...plugins, assertEverySeamFired(workspaceRoot, replacements, fired)];
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
 * Version two asserts the positive: a seam that reached the graph must have
 * fired, or the replacement file must be among the modules (Angular
 * `fileReplacements` / `resolve.alias` can land it there without going through
 * `beforeResolve`). Paired with the `existsSync` check above, a mistyped path
 * now fails twice before it can reach a bundle.
 *
 * Assertion is per seam, not all-or-nothing. `remote.util.ts` is a static
 * import from `app.routes.ts` and is in the first emit; the registry is only
 * reached from the lazy `home` route. Treating "one seam present" as "both
 * must have fired" fails `rspack serve` on the initial compile, which is
 * exactly when the home chunk has not been asked for yet.
 */
function assertEverySeamFired(
  workspaceRoot: string,
  replacements: readonly SeamReplacement[],
  fired: ReadonlySet<string>,
): RspackPluginInstance {
  return {
    apply(compiler) {
      compiler.hooks.afterEmit.tap(`${pluginName}Assert`, (compilation) => {
        const resources = [...compilation.modules].flatMap((mod) => {
          const resource = moduleResource(mod);

          return resource === undefined ? [] : [normalizePath(resource)];
        });

        const missed = replacements.filter((seam) => {
          if (fired.has(seam.original)) {
            return false;
          }

          const originalId = normalizePath(resolve(workspaceRoot, seam.original));
          const replacementId = normalizePath(resolve(workspaceRoot, seam.replacement));

          if (resources.includes(replacementId)) {
            return false;
          }

          // Not in this compilation - the lazy home route has not been walked.
          return resources.includes(originalId);
        });

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

function normalizeRequest(context: string, request: string): string {
  const bare = stripQuery(request);

  return normalizePath(bare.startsWith('.') ? resolve(context, bare) : bare);
}

function normalizePath(path: string): string {
  return stripExtension(stripQuery(path));
}

function stripQuery(path: string): string {
  const cut = path.search(/[?#]/);

  return cut === -1 ? path : path.slice(0, cut);
}

function stripExtension(path: string): string {
  return path.replace(/\.[cm]?tsx?$/, '');
}

function resolveResource(data: object): string | undefined {
  const created = createdModule(data);

  if (typeof created?.resource === 'string') {
    return created.resource;
  }

  if ('resource' in data && typeof data.resource === 'string') {
    return data.resource;
  }

  return undefined;
}

function createdModule(data: object): { resource?: string; userRequest?: string } | undefined {
  if (!('createData' in data) || data.createData === null || typeof data.createData !== 'object') {
    return undefined;
  }

  return data.createData as { resource?: string; userRequest?: string };
}

function moduleResource(mod: object): string | undefined {
  if ('resource' in mod && typeof mod.resource === 'string') {
    return mod.resource;
  }

  return undefined;
}
