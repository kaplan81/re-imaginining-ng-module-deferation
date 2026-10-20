#!/usr/bin/env node
/**
 * Times a cold production build of all five applications on each of the three
 * pipelines, and measures what each one puts on disk.
 *
 * Why this exists: the Zürich deck quoted 8.4 / 10.3 / 8.1 seconds without
 * recording what "cold" meant. It matters a great deal here, because the three
 * pipelines keep their caches in different places and one of them is large:
 *
 *   build 1   .angular/cache                        (Angular CLI)
 *             node_modules/.cache/native-federation (~37 MB of pre-bundled
 *                                                    shared packages)
 *   build 2   .nx/workspace-data                    (via @nx/angular-rspack)
 *   build 3   node_modules/.cache/analog            (@analogjs/vite-plugin-angular)
 *             node_modules/.vite
 *
 * A run that leaves build 1's native-federation cache in place is not measuring
 * the same thing as a run that clears build 2's. This script clears each
 * pipeline's own caches AND its dist output before every run, so "cold" means the
 * same thing three times.
 *
 * ---------------------------------------------------------------------------
 * THE RULE
 * ---------------------------------------------------------------------------
 *   - Before each run: delete that pipeline's caches and dist output.
 *   - Time the pipeline's own all-five-apps script, wall clock, as a user would.
 *   - Repeat (default twice) and report every run, not an average. A number only
 *     goes on a slide if the runs agree.
 *   - Record the machine and the date, because a build time without them is not
 *     a measurement.
 *
 * Disk sizes are measured after the final run: total bytes of .js emitted per
 * pipeline, and the same for the `top-lots` application alone, which the deck
 * uses as its per-application figure.
 *
 * Usage: node tools/measure-builds.mjs [--runs N] [--json] [--only 1|2|3]
 */

import { execSync } from 'node:child_process';
import { rmSync, existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cpus, totalmem } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PIPELINES = {
  '1 · Angular CLI + Native Federation': {
    key: '1',
    command: 'npm run build',
    caches: ['.angular/cache', 'node_modules/.cache/native-federation'],
    dist: ['dist'],
    // per-application output lives in dist/<app>/browser
    appDist: (app) => `dist/${app}/browser`,
  },
  '2 · Rspack + classic MF': {
    key: '2',
    command: 'npm run build:rspack:all',
    caches: ['.nx/workspace-data'],
    dist: [
      'builds/rspack/catalog/dist',
      'builds/rspack/orders/dist',
      'builds/rspack/top-lots/dist',
      'builds/rspack/roast-queue/dist',
      'builds/rspack/shell/dist',
    ],
    appDist: (app) => `builds/rspack/${app}/dist`,
  },
  '3 · Vite + classic MF': {
    key: '3',
    command: 'npm run build:vite:all',
    caches: ['node_modules/.cache/analog', 'node_modules/.vite'],
    dist: [
      'builds/vite/catalog/dist',
      'builds/vite/orders/dist',
      'builds/vite/top-lots/dist',
      'builds/vite/roast-queue/dist',
      'builds/vite/shell/dist',
    ],
    appDist: (app) => `builds/vite/${app}/dist`,
  },
};

const APPS = ['shell', 'catalog', 'orders', 'top-lots', 'roast-queue'];

const args = process.argv.slice(2);
const runs = Number(args[args.indexOf('--runs') + 1]) || 2;
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const asJson = args.includes('--json');

function wipe(paths) {
  for (const p of paths) rmSync(join(root, p), { recursive: true, force: true });
}

/** Total bytes of .js under a directory, recursively. */
function jsBytes(dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return null;
  let total = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.js')) total += statSync(full).size;
    }
  };
  walk(abs);
  return total;
}

const log = (...a) => {
  if (!asJson) console.log(...a);
};

const machine = {
  date: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
  cpu: cpus()[0]?.model ?? 'unknown',
  cores: cpus().length,
  memoryGB: Math.round(totalmem() / 1024 ** 3),
  node: process.version,
  commit: execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(),
};

log(`\nCold production build, five applications, ${runs} runs per pipeline`);
log(`${machine.cpu}, ${machine.cores} cores, ${machine.memoryGB} GB · node ${machine.node}`);
log(`${machine.date} · commit ${machine.commit}`);
log('Caches cleared before every run — see the header of tools/measure-builds.mjs\n');

const results = {};

for (const [name, p] of Object.entries(PIPELINES)) {
  if (only && p.key !== only) continue;
  const times = [];
  log(name);
  for (let i = 1; i <= runs; i++) {
    wipe(p.caches);
    wipe(p.dist);
    const started = Date.now();
    let ok = true;
    try {
      execSync(p.command, { cwd: root, stdio: 'pipe' });
    } catch {
      ok = false;
    }
    const seconds = (Date.now() - started) / 1000;
    times.push(ok ? seconds : null);
    log(`  run ${i}  ${ok ? seconds.toFixed(1) + ' s' : 'FAILED'}`);
  }

  const good = times.filter((t) => t !== null);
  const spread = good.length > 1 ? Math.max(...good) - Math.min(...good) : 0;
  const perApp = {};
  for (const app of APPS) perApp[app] = jsBytes(p.appDist(app));
  const totalJs = Object.values(perApp).reduce((a, b) => a + (b ?? 0), 0);

  results[name] = {
    runs: times,
    fastest: good.length ? Math.min(...good) : null,
    spread,
    reproducible: good.length === runs && spread <= Math.min(...good) * 0.15,
    jsBytes: { total: totalJs, perApp },
  };

  if (good.length) {
    log(
      `  fastest ${Math.min(...good).toFixed(1)} s · spread ${spread.toFixed(1)} s · ` +
        `${results[name].reproducible ? 'reproducible' : 'NOT reproducible — do not quote'}`,
    );
    log(
      `  JS on disk, 5 apps: ${(totalJs / 1024).toFixed(0)} kB · top-lots: ${((perApp['top-lots'] ?? 0) / 1024).toFixed(0)} kB\n`,
    );
  } else {
    log('  all runs failed\n');
  }
}

if (asJson) {
  console.log(JSON.stringify({ machine, runs, results }, null, 2));
  process.exit(0);
}

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

log('Summary' + ' '.repeat(26) + 'cold   spread   5-app JS   top-lots');
for (const [name, r] of Object.entries(results)) {
  if (!r.fastest) continue;
  log(
    `  ${pad(name, 31)} ${num(r.fastest.toFixed(1) + ' s', 6)} ${num(r.spread.toFixed(1) + ' s', 8)} ` +
      `${num((r.jsBytes.total / 1024).toFixed(0) + ' kB', 10)} ${num(((r.jsBytes.perApp['top-lots'] ?? 0) / 1024).toFixed(0) + ' kB', 10)}`,
  );
}
log(`
Reading these numbers
---------------------
COLD is the fastest of ${runs} runs, not an average: the fastest run is the one
least polluted by other work on the machine. SPREAD is the gap between runs; a
pipeline is only marked reproducible when every run succeeded and the spread is
within 15% of the fastest. Do not put a non-reproducible number on a slide.

"Cold" means each pipeline's OWN caches were cleared. That is not a detail: build
1 keeps ~37 MB of pre-bundled shared packages in node_modules/.cache, and leaving
it warm makes build 1 look far faster than a first build on a colleague's machine
or in CI ever will.

JS ON DISK counts every emitted .js byte, uncompressed. It is a proxy for what a
pipeline produces, not for what a browser downloads — transferred bytes are
measured separately against a running server.
`);
