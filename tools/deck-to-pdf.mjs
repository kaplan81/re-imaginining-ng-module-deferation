#!/usr/bin/env node
/**
 * Renders the deck under `docs/deck/` to a single presentation PDF, one slide per
 * page, each page exactly 16:9.
 *
 * Why this exists: the deck lives in a Slides artifact, which is fine for building
 * it and useless for presenting it on a laptop with no network. This produces a
 * file that opens in Preview or Keynote, goes full screen, and advances with the
 * arrow keys — and that can be committed, so anyone reading the repository can see
 * the talk without an account anywhere.
 *
 * Page size. The conference wants 1920 x 1080, 16:9, with no black borders
 * (`docs/NG-POLAND-2026.md` section 7). A PDF has no pixels, so the page is set to
 * 1920px x 1080px of CSS length, which Chrome writes as 1440 x 810 points — the
 * same 16:9 rectangle, and the text stays vector, so it is sharp at any projector
 * or capture resolution.
 *
 * Speaker notes are dropped; `tools/deck-to-reveal.mjs` keeps them.
 *
 * Usage: node tools/deck-to-pdf.mjs [--out <path>] [--html] [--keep]
 *   --html   also write the intermediate single-file HTML next to the PDF
 *   --keep   do not delete the temporary working directory
 */

import { writeFileSync, mkdtempSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { loadDeck, RESET_CSS } from './lib/deck-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => (argv.indexOf(n) >= 0 && argv[argv.indexOf(n) + 1]) || d;

const outPath = resolve(root, opt('--out', join('docs', 'Re-imagining-Module-Federation-in-Angular.pdf')));

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('No Chrome, Chromium or Edge found. Install one, or export from the artifact instead.');
  process.exit(1);
}

const { index, slides, connectors } = loadDeck(join(root, 'docs', 'deck', 'project'));

const fonts = Object.values(index.faces ?? {})
  .map((f) => `<link rel="stylesheet" href="${f.href}">`)
  .join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${index.title}</title>
${fonts}
<style>
  @page { size: 1920px 1080px; margin: 0; }
  ${RESET_CSS}
  html, body { margin: 0; padding: 0; background: #111317; }
  section {
    position: relative;
    width: 1920px; height: 1080px;
    overflow: hidden;
    break-after: page; page-break-after: always;
  }
  section:last-of-type { break-after: auto; page-break-after: auto; }
</style></head>
<body>
${slides.map((s) => s.outerHTML).join('\n')}
</body></html>
`;

const work = mkdtempSync(join(tmpdir(), 'deck-pdf-'));
const htmlPath = join(work, 'deck.html');
writeFileSync(htmlPath, html);

execFileSync(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=30000',
    `--print-to-pdf=${outPath}`,
    `file://${htmlPath}`,
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

if (flag('--html')) copyFileSync(htmlPath, outPath.replace(/\.pdf$/, '.html'));
if (!flag('--keep')) rmSync(work, { recursive: true, force: true });

console.log(`${outPath.replace(root + '/', '')} — ${slides.length} slides, ${connectors} connectors redrawn`);
