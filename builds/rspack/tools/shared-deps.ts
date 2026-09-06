import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Module Federation share map, derived from `package.json`.
 *
 * This function exists to answer a question the talk asks directly. Native
 * Federation ships `shareAll(...)`, so the baseline's share map is one call and
 * cannot drift from the dependency list. Classic Module Federation has no
 * equivalent: every example - including the two Zephyr Angular ones - writes the
 * map out by hand, repeating a `requiredVersion` string per package that has to
 * be edited again on every Angular upgrade, on both sides of every boundary.
 *
 * So: this file is the honest comparison. `shareAll` versus *this much code* is
 * the number to put on the slide, not `shareAll` versus a hand-written literal
 * that quietly rots. It is not much code - which is rather the point. The cost
 * of the manual map is not that it is hard to write once, it is that nothing
 * tells you when it is wrong.
 *
 * Two behaviours are being reproduced deliberately:
 *
 * - **Secondary entry points.** `@angular/common` and `@angular/common/http` are
 *   separate modules. Sharing the package does not share its subpaths, so a
 *   remote that injects `HttpClient` would get its own copy and the shell's
 *   `EnvironmentInjector` would no longer be the one that created it. The
 *   trailing-slash key is MF's prefix share, and it is the counterpart of the
 *   baseline's `includeSecondaries: { keepAll: true }`.
 * - **`skip`.** The same four `rxjs` entry points the baseline skips, for the
 *   same reason: nothing here imports them, and sharing them would put four
 *   more negotiated modules in every remoteEntry for nothing.
 */

/** Matches the `skip` array in every `projects/*\/federation.config.mjs`. */
const skip = new Set(['rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket']);

/**
 * Packages whose secondary entry points must be shared too. `@angular/core`
 * reaches for `@angular/core/primitives/*` internally, and two copies of the
 * signals primitives is the same page-breaking bug as two copies of core.
 */
const withSecondaries = new Set(['@angular/core', '@angular/common', '@angular/router']);

export interface SharedEntry {
  singleton: boolean;
  strictVersion: boolean;
  requiredVersion: string;
}

export function sharedDependencies(projectDir: string): Record<string, SharedEntry> {
  const root = join(projectDir, '..', '..', '..');
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };

  const shared: Record<string, SharedEntry> = {};

  for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
    if (skip.has(name)) {
      continue;
    }

    // `strictVersion` turns a version mismatch into a loud failure instead of a
    // second copy of Angular loaded quietly alongside the first. The baseline
    // makes the same choice; it is the whole reason the parity checklist can
    // assert "exactly one @angular/core".
    const entry: SharedEntry = { singleton: true, strictVersion: true, requiredVersion: range };

    shared[name] = entry;

    if (withSecondaries.has(name)) {
      shared[`${name}/`] = entry;
    }
  }

  return shared;
}
