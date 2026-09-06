import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * The Module Federation share map, derived from `package.json`.
 *
 * A near-copy of `builds/rspack/tools/shared-deps.ts`, and deliberately a copy
 * rather than an import. The two pipelines are meant to be independently
 * readable and independently breakable - the same reason the five projects each
 * own a byte-identical `_tokens.scss` instead of sharing one. A talk that shows
 * "build 3 imports build 2's tooling" has quietly made them one thing.
 *
 * The point it makes is unchanged: Native Federation's `shareAll(...)` derives
 * the share map from `package.json` and cannot drift. Classic Module Federation
 * has no equivalent on either bundler, so the choice is a hand-written literal
 * that rots or this. The cost of the manual map is not that it is hard to write
 * once; it is that nothing tells you when it is wrong.
 */

/** Matches the `skip` array in every `projects/*\/federation.config.mjs`. */
const skip = new Set(['rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket']);

/**
 * Packages in `dependencies` that nothing imports at runtime.
 *
 * This list exists because `@module-federation/vite` does **not** prune unused
 * shares, and the difference is not cosmetic. Every declared share gets a
 * `__prebuild__` fallback chunk emitted into every application - the local copy
 * used if the share scope cannot supply one - so declaring `@angular/compiler`
 * put a **607 kB** JIT compiler into all five `dist/` folders, plus 66 kB of
 * `@angular/forms`, for packages this product never loads.
 *
 * Two of the three pipelines do this automatically. Build 1's `shareAll(...)`
 * has `ignoreUnusedDeps` on by default; build 2's Rspack plugin only emits a
 * share for a module something actually consumed - its `top-lots` manifest lists
 * 8 shares to this one's 9, and its `dist/` is 752 kB to this one's 1452 kB
 * before pruning. Here it is hand-maintained, which means it is also a trap:
 * add a Signal Form to a remote and the build will quietly not share
 * `@angular/forms` until someone edits this line.
 *
 * `@angular/compiler` is a build-time dependency. AOT is in effect (Analog's
 * `jit` option defaults to false), so no JIT compiler is needed at runtime - see
 * `docs/PLAN-VITE.md` for the check.
 */
const unusedAtRuntime = new Set(['@angular/compiler', '@angular/forms']);

/**
 * Packages whose secondary entry points must be shared too. `@angular/common`
 * and `@angular/common/http` are separate modules: sharing the package does not
 * share its subpaths, so a remote injecting `HttpClient` would get its own copy
 * and the host's `EnvironmentInjector` would no longer be the one that created
 * it. This is the counterpart of build 1's `includeSecondaries: { keepAll: true }`.
 */
const withSecondaries = new Set(['@angular/core', '@angular/common', '@angular/router']);

export interface SharedEntry {
  singleton: boolean;
  strictVersion: boolean;
  requiredVersion: string;
}

export interface SharedOptions {
  /**
   * Extra packages this application does not use. A widget microfrontend passes
   * `['@angular/router']`: it has no router at all, so sharing one would ship a
   * 101 kB fallback copy of a package it can never import. Build 1 derives the
   * same exclusion automatically from what the *exposed* entry point uses.
   */
  omit?: readonly string[];
}

export function sharedDependencies({ omit = [] }: SharedOptions = {}): Record<string, SharedEntry> {
  const omitted = new Set(omit);
  const manifest = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };

  const shared: Record<string, SharedEntry> = {};

  for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
    if (skip.has(name) || unusedAtRuntime.has(name) || omitted.has(name)) {
      continue;
    }

    // `strictVersion` turns a version mismatch into a loud failure instead of a
    // second copy of Angular loaded quietly alongside the first. It is what lets
    // the parity checklist assert "exactly one @angular/core".
    const entry: SharedEntry = { singleton: true, strictVersion: true, requiredVersion: range };

    shared[name] = entry;

    if (withSecondaries.has(name)) {
      shared[`${name}/`] = entry;
    }
  }

  return shared;
}

/**
 * What Vite must pre-bundle before the first request, in dev.
 *
 * Without this, Vite discovers Angular's secondary entry points only when a
 * module first imports them, mid-page-load. It then re-optimises and forces a
 * reload, and the reload races the in-flight graph:
 *
 *   [vite] dependencies optimized: @angular/common/http, @angular/core/primitives/di, …
 *   [vite] optimized dependencies changed. reloading
 *   TypeError: Failed to fetch dynamically imported module: …@angular_core_primitives_signals.js
 *   TypeError: provideRouter is not a function
 *
 * A second reload clears it, which is exactly what makes it easy to dismiss as
 * flakiness. Naming the entry points up front removes the discovery step.
 *
 * This is the shape the plan's `optimizeDeps` risk actually took. The predicted
 * failure was a *second* copy of Angular pre-bundled beside the shared one;
 * measured, that does not happen - every `__prebuild__` fallback in the built
 * output stays unfetched and the share scope holds exactly one
 * `@angular/core@22.1.5`. The real cost was a dev-only reload race instead.
 *
 * Note these are import specifiers, not share keys: the trailing-slash prefix
 * form the share map uses (`@angular/common/`) is a Module Federation notion and
 * means nothing to Vite.
 */
export const optimizeDepsInclude: readonly string[] = [
  '@angular/core',
  '@angular/core/primitives/di',
  '@angular/core/primitives/signals',
  '@angular/common',
  '@angular/common/http',
  '@angular/platform-browser',
  '@angular/router',
  'rxjs',
  'rxjs/operators',
  'tslib',
];
