import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Swaps the shell's federation seam, module for module, at bundle time.
 *
 * Same job as `builds/rspack/tools/seam.ts`, and the same reasoning: four of the
 * five applications compile from `projects/*` untouched, because their exposed
 * entry points contain no federation API at all. The shell is the exception - it
 * is the only application that *calls* a federation runtime, and Native
 * Federation's and Module Federation's runtimes are different APIs.
 *
 * Copying the seam files into this build would have been much worse.
 * `remote.util.ts` is reached from `app.routes.ts` by a *relative* import, so a
 * copy drags in copies of `app.routes.ts`, `app.config.ts`, `bootstrap.ts` and
 * `remote-slot.component.ts` - six files duplicated to change two, and the
 * talk's central claim weakened by each one.
 *
 * The Rollup version is markedly simpler than the Rspack one. `resolveId` is
 * handed the importer and the raw specifier and is expected to *return* the
 * resolved id, so redirecting is one comparison and one return - no factory
 * hooks, no mutation of a resolve-data object, no guessing whether the plugin
 * matches the request or the resolved path. Build 2's first attempt at this
 * silently did nothing and shipped build 1's Native Federation calls inside a
 * green build; this shape makes that failure much harder to write.
 *
 * The assertion is kept anyway, for the same reason it was added there: a
 * mistyped path is otherwise a runtime failure on first navigation rather than
 * a build error.
 */
export interface SeamReplacement {
  /** Path of the build-1 module to replace, relative to the workspace root. */
  original: string;
  /** Path of this pipeline's version, relative to the workspace root. */
  replacement: string;
}

export function seamPlugin(replacements: readonly SeamReplacement[]): Plugin {
  // Keyed without the extension, because that is the shape a TypeScript
  // relative import resolves to: `./utils/remote/remote.util`, no `.ts`.
  const bySpecifier = new Map<string, string>();

  for (const seam of replacements) {
    const original = resolve(workspaceRoot, seam.original);
    const replacement = resolve(workspaceRoot, seam.replacement);

    // Checked here, not assumed. A path that does not exist is the failure this
    // whole guard is about - see `assertEverySeamFired` - and catching it at
    // config time gives a message that names the file instead of a green build
    // that ships the wrong federation runtime.
    for (const [label, path] of [
      ['original', original],
      ['replacement', replacement],
    ] as const) {
      if (!existsSync(path)) {
        throw new Error(
          `[seam] the ${label} "${relative(workspaceRoot, path)}" does not exist. ` +
            `Fix the path in the shell's vite.config.ts.`,
        );
      }
    }

    bySpecifier.set(stripExtension(original), replacement);
  }

  const fired = new Set<string>();
  let isBuild = false;

  return {
    name: 'rr:federation-seam',

    // Ahead of the alias and Angular plugins, so the redirect happens before
    // anything else claims the id.
    enforce: 'pre',

    configResolved(config) {
      isBuild = config.command === 'build';
    },

    resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) {
        return null;
      }

      const target = bySpecifier.get(stripExtension(resolve(dirname(importer), source)));

      if (target) {
        fired.add(target);

        return target;
      }

      return null;
    },

    buildEnd() {
      assertEverySeamFired(replacements, fired, isBuild, (message) => this.error(message));
    },
  };
}

/**
 * Fails a production build unless every seam was actually substituted.
 *
 * This is the second version of this check, and the first one was wrong in a way
 * worth putting on a slide, because build 2 shipped the same mistake.
 *
 * Version one asked "did an *unreplaced original* reach the module graph?" - it
 * looked for `projects/shell/.../remote.util.ts` among the built modules and
 * errored if it found it. That reasoning is circular. The failure it exists to
 * catch is a wrong path in the config, and when the path is wrong there is
 * nothing left to compare against: the redirect silently never matches, the real
 * file resolves normally under its real name, the search for the *misspelled*
 * name finds nothing, and the build goes green with build 1's Native Federation
 * calls compiled into build 3. Verified by deliberately misspelling the path -
 * `Federation runtime is not ready: initFederation() has not resolved yet` was
 * sitting in the output bundle.
 *
 * Version two asserts the positive instead: every configured replacement must
 * have been substituted at least once. Both seam modules are reached by static
 * import from `app.routes.ts` and `home.component.ts`, so in a production build
 * they are always in the graph - if one did not fire, the redirect is broken,
 * whatever the reason. Paired with the `existsSync` check above, a mistyped path
 * now fails twice before it can reach a bundle.
 *
 * Skipped outside `vite build`: the dev server compiles on demand, so a seam
 * that nothing has requested yet is legitimately absent.
 */
function assertEverySeamFired(
  replacements: readonly SeamReplacement[],
  fired: ReadonlySet<string>,
  isBuild: boolean,
  fail: (message: string) => void,
): void {
  if (!isBuild) {
    return;
  }

  const missed = replacements.filter(
    (seam) => !fired.has(resolve(workspaceRoot, seam.replacement)),
  );

  if (missed.length > 0) {
    fail(
      `[seam] ${missed.length} of ${replacements.length} seam modules were never substituted:\n` +
        missed.map((seam) => `  - ${seam.original}`).join('\n') +
        `\nBuild 1's federation runtime calls would ship inside build 3.`,
    );
  }
}

function stripExtension(path: string): string {
  return path.replace(/\.[cm]?tsx?$/, '');
}
