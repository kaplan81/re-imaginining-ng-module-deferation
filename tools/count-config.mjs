#!/usr/bin/env node
/**
 * Counts the build and federation configuration of each of the three pipelines,
 * under an explicit rule, so a slide can cite a rule instead of a remembered
 * number.
 *
 * Why this exists: the Zürich deck claimed 156 / 340 / 382 lines for builds
 * 1 / 2 / 3. Those numbers are not reproducible from this tree under any rule we
 * could find, and they appear to have compared unlike things - build 1 counted as
 * federation config only (its five `federation.config.mjs`, ~191 lines) against
 * builds 2 and 3 counted as their whole config surface. On a like-for-like count
 * the ordering of builds 2 and 3 reverses.
 *
 * ---------------------------------------------------------------------------
 * THE RULE
 * ---------------------------------------------------------------------------
 * A file counts for a pipeline when it exists in order to make THAT pipeline
 * build, and would not exist if the pipeline did not. Four categories:
 *
 *   bundler    the builder/bundler configuration proper
 *   federation configuration that exists only because of Module Federation
 *   typescript tsconfig files the pipeline's build reads
 *   manifest   package.json files that exist only to define a pipeline workspace
 *
 * Counted two ways:
 *   raw   every line in the file
 *   code  non-blank lines that are not wholly a comment
 *
 * EXCLUDED, deliberately:
 *   - `tsconfig.spec.json` - test configuration, identical in spirit across all
 *     three, and no pipeline's build reads it.
 *   - `federation.manifest.json` and `widget-slots.json` - deployment DATA, not
 *     configuration. Byte-comparable across all three pipelines, so they cancel.
 *     That they are data is itself a point the talk makes.
 *   - the root `package.json` and lockfile - shared by all three; the per-pipeline
 *     dependency cost is reported separately as a package count.
 *   - `tools/check-ports.mjs` and this file - shared harness, not pipeline config.
 *
 * NOTE ON BUILD 1's `angular.json`: it is one workspace file covering all five
 * applications, and it also carries test targets, schematics and budgets that
 * builds 2 and 3 simply do not have. It is counted, because you must write it to
 * build this pipeline - but the per-category breakdown prints it separately so the
 * asymmetry is visible rather than hidden inside a total.
 *
 * Usage: node tools/count-config.mjs [--json]
 */

import { readFileSync, existsSync } from 'node:fs';
import { globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Files that exist to make a given pipeline build, by category. */
const PIPELINES = {
  '1 · Angular CLI + Native Federation': {
    bundler: ['angular.json'],
    federation: ['projects/*/federation.config.mjs'],
    typescript: [
      'tsconfig.json',
      'projects/*/tsconfig.app.json',
      'projects/*/tsconfig.federation.json',
    ],
    manifest: [],
  },
  '2 · Rspack + classic MF': {
    bundler: ['builds/rspack/*/rspack.config.ts'],
    federation: ['builds/rspack/tools/*.ts'],
    typescript: ['builds/rspack/tsconfig.base.json', 'builds/rspack/*/tsconfig.json'],
    manifest: ['builds/rspack/*/package.json'],
  },
  '3 · Vite + classic MF': {
    bundler: ['builds/vite/*/vite.config.ts'],
    federation: ['builds/vite/tools/*.ts'],
    typescript: ['builds/vite/tsconfig.base.json', 'builds/vite/*/tsconfig.json'],
    manifest: ['builds/vite/package.json', 'builds/vite/*/package.json'],
  },
};

/** Build-tooling packages each pipeline requires in the root manifest. */
const TOOLING = {
  '1 · Angular CLI + Native Federation': [
    '@angular-architects/native-federation',
    '@softarc/native-federation-orchestrator',
  ],
  '2 · Rspack + classic MF': [
    '@rspack/cli',
    '@rspack/core',
    '@rspack/dev-server',
    '@module-federation/enhanced',
    '@module-federation/rspack',
    '@nx/angular-rspack',
  ],
  '3 · Vite + classic MF': [
    'vite',
    '@module-federation/vite',
    '@module-federation/runtime',
    '@analogjs/vite-plugin-angular',
  ],
};

const COMMENT = /^\s*(\/\/|\/\*|\*\/|\*(?!\/))/;

function countFile(file) {
  const lines = readFileSync(join(root, file), 'utf8').split('\n');
  // a trailing newline yields one empty final element; it is not a line
  if (lines.at(-1) === '') lines.pop();
  const raw = lines.length;
  const code = lines.filter((l) => l.trim() !== '' && !COMMENT.test(l)).length;
  return { file, raw, code };
}

function expand(patterns) {
  const out = [];
  for (const p of patterns) {
    if (p.includes('*')) out.push(...globSync(p, { cwd: root }).sort());
    else if (existsSync(join(root, p))) out.push(p);
  }
  // globSync can yield duplicates when patterns overlap
  return [...new Set(out.map((f) => relative('.', f)))];
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const declared = { ...pkg.dependencies, ...pkg.devDependencies };

const report = {};
for (const [name, categories] of Object.entries(PIPELINES)) {
  const byCategory = {};
  let raw = 0;
  let code = 0;
  let files = 0;
  for (const [category, patterns] of Object.entries(categories)) {
    const counted = expand(patterns).map(countFile);
    const sub = counted.reduce(
      (a, c) => ({ raw: a.raw + c.raw, code: a.code + c.code, files: a.files + 1 }),
      { raw: 0, code: 0, files: 0 },
    );
    byCategory[category] = { ...sub, entries: counted };
    raw += sub.raw;
    code += sub.code;
    files += sub.files;
  }
  report[name] = {
    total: { raw, code, files },
    byCategory,
    tooling: TOOLING[name].map((p) => ({ package: p, version: declared[p] ?? null })),
  };
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

console.log('\nBuild and federation configuration, counted by tools/count-config.mjs');
console.log('Rule and exclusions are documented at the top of that file.\n');

for (const [name, r] of Object.entries(report)) {
  console.log(name);
  for (const [category, c] of Object.entries(r.byCategory)) {
    if (c.files === 0) {
      console.log(`  ${pad(category, 11)} ${num('-', 5)} ${num('-', 6)}   (none)`);
      continue;
    }
    console.log(`  ${pad(category, 11)} ${num(c.raw, 5)} ${num(c.code, 6)}   ${c.files} file(s)`);
    for (const e of c.entries) {
      console.log(`      ${pad(e.file, 48)} ${num(e.raw, 5)} ${num(e.code, 6)}`);
    }
  }
  console.log(
    `  ${pad('TOTAL', 11)} ${num(r.total.raw, 5)} ${num(r.total.code, 6)}   ${r.total.files} files, ${r.tooling.length} tooling packages\n`,
  );
}

console.log('All pipeline configuration' + ' '.repeat(7) + 'raw   code  files  pkgs');
for (const [name, r] of Object.entries(report)) {
  console.log(
    `  ${pad(name, 31)} ${num(r.total.raw, 5)} ${num(r.total.code, 6)} ${num(r.total.files, 6)} ${num(r.tooling.length, 5)}`,
  );
}

console.log('\nFederation configuration only' + ' '.repeat(4) + 'raw   code  files');
for (const [name, r] of Object.entries(report)) {
  const f = r.byCategory.federation;
  console.log(`  ${pad(name, 31)} ${num(f.raw, 5)} ${num(f.code, 6)} ${num(f.files, 6)}`);
}

console.log(`
Reading these numbers
---------------------
RAW is the fairer cross-pipeline comparison. Build 1's configuration is mostly
JSON, which has no blank or comment lines, so it scores ~100% "code"; builds 2
and 3 are mostly TypeScript, which is roughly 40% code by this measure. Comparing
CODE across a JSON-heavy and a TS-heavy pipeline flatters the TS one.

FEDERATION ONLY is the number the talk is actually about - what Module Federation
costs you on each pipeline, with the workspace and TypeScript boilerplate removed.
Note that builds 2 and 3 put their federation logic in 'tools/', while build 1 puts
it in five 'federation.config.mjs' files; those are the like-for-like pair.

BUILD 1's 'angular.json' is one workspace file covering all five applications, and
it also carries test targets, schematics and budgets that builds 2 and 3 have no
equivalent of. It is counted because you must write it, but it is why build 1's
total looks large next to its federation-only figure.

TOOLING PACKAGES is the most robust number of the four: it cannot drift when
someone refactors a tools file, and it answers what an audience actually asks -
what do I have to install to get this?
`);
