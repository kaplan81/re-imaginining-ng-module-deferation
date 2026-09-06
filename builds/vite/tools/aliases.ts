import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const tsconfigPath = resolve(here, '..', 'tsconfig.base.json');

/**
 * Vite's counterpart of the `paths` in `tsconfig.base.json`.
 *
 * A small difference from build 2 that costs a file. `@nx/angular-rspack` feeds
 * the tsconfig to the bundler's resolver, so `paths` govern type-checking *and*
 * module resolution and there is nothing to write. Vite does not: `paths` are a
 * TypeScript-only concept there, so `@rr/catalog/catalog.routes` type-checks
 * happily and then fails at bundle time with "Rolldown failed to resolve
 * import". The two have to be declared twice.
 *
 * Declared twice, but not *written* twice - the aliases below are derived from
 * the same tsconfig the compiler reads, so the two cannot drift. The usual
 * alternative is `vite-tsconfig-paths`, a fourth-party dependency to make two
 * first-party tools agree about where files are; this is the same idea in a
 * dozen lines and no extra package.
 *
 * `ts.readConfigFile` rather than `JSON.parse` because tsconfigs are JSONC and
 * that file carries an explanatory header comment.
 */
export function workspaceAliases(): { find: RegExp; replacement: string }[] {
  const { config, error } = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

  if (error) {
    throw new Error(`could not read ${tsconfigPath}: ${error.messageText.toString()}`);
  }

  const paths = (config as { compilerOptions?: { paths?: Record<string, string[]> } })
    .compilerOptions?.paths;

  if (!paths) {
    throw new Error(`${tsconfigPath} declares no compilerOptions.paths`);
  }

  return Object.entries(paths).map(([pattern, [target]]) => {
    if (!pattern.endsWith('/*') || !target?.endsWith('/*')) {
      throw new Error(`alias "${pattern}" is not of the supported "prefix/*" form`);
    }

    const prefix = pattern.slice(0, -1);

    return {
      find: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      // `paths` targets are relative to the tsconfig that declares them. The
      // trailing separator has to be put back by hand: `resolve` normalises it
      // away, and without it `@rr/catalog-app/app.config` resolves to
      // `.../app/appapp.config` - a path that does not exist, reported as a
      // missing file rather than as a broken alias.
      replacement: `${resolve(here, '..', target.slice(0, -1))}/`,
    };
  });
}
