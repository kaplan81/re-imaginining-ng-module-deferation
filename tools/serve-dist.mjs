#!/usr/bin/env node
/**
 * Serves a pipeline's five production `dist` folders on that pipeline's ports,
 * using one static server implementation for all three.
 *
 * Why this exists: transferred-bytes numbers are only comparable if the thing
 * doing the transferring is identical. `ng serve`, `rspack serve` and `vite
 * preview` are three different servers with three different compression and
 * caching defaults, so measuring a production bundle through each pipeline's own
 * dev server compares the servers as much as the bundles. This serves all three
 * the same way: no compression, no caching, correct content types.
 *
 * Ports match the dev-server ports so each pipeline's committed
 * `federation.manifest.json` resolves without edits.
 *
 * Usage: node tools/serve-dist.mjs <1|2|3>
 *        (Ctrl-C to stop; the process serves until killed.)
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const APPS = ['shell', 'catalog', 'orders', 'top-lots', 'roast-queue'];

const PIPELINES = {
  1: { name: 'Native Federation on Angular CLI', base: 4200, dir: (a) => `dist/${a}/browser` },
  2: {
    name: 'Module Federation on Rspack',
    base: 4210,
    dir: (a) => `builds/rspack/${a}/dist/browser`,
  },
  3: { name: 'Module Federation on Vite', base: 5173, dir: (a) => `builds/vite/${a}/dist` },
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const which = process.argv[2];
const pipeline = PIPELINES[which];
if (!pipeline) {
  console.error('Usage: node tools/serve-dist.mjs <1|2|3>');
  process.exit(1);
}

for (const [i, app] of APPS.entries()) {
  const dir = join(root, pipeline.dir(app));
  const port = pipeline.base + i;

  if (!existsSync(dir)) {
    console.error(`  ${app} :${port}  MISSING ${pipeline.dir(app)} — build this pipeline first`);
    continue;
  }

  createServer((req, res) => {
    // strip query/hash, block traversal
    const requested = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0]);
    let file = join(dir, normalize(requested).replace(/^(\.\.[/\\])+/, ''));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    // SPA fallback: unknown paths render the shell
    if (!existsSync(file)) file = join(dir, 'index.html');

    if (!existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Content-Length': statSync(file).size,
      // identical, deliberately boring policy for all three pipelines
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      // Without this, the Performance API reports 0 bytes for every
      // cross-origin resource - which is most of what federation fetches.
      // Omitting it makes a pipeline that loads more from remotes look smaller.
      'Timing-Allow-Origin': '*',
    });
    createReadStream(file).pipe(res);
  }).listen(port, () => console.log(`  ${app.padEnd(12)} :${port}  ${pipeline.dir(app)}`));
}

console.log(`\nServing pipeline ${which} — ${pipeline.name}`);
console.log('No compression, no caching, same server for all three pipelines.\n');
