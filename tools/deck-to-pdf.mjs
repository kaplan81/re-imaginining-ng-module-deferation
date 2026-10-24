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
 * `<aside>` speaker notes are dropped. `<x-connector>` is an element of the Slides
 * artifact type, so it is redrawn here as inline SVG; only the routes the deck
 * actually uses are supported, and anything else stops the build rather than
 * rendering wrongly.
 *
 * `docs/deck/` is the source of truth. Edit the slides there, publish from there,
 * and regenerate this afterwards.
 *
 * Usage: node tools/deck-to-pdf.mjs [--out <path>] [--html] [--keep]
 *   --html   also keep the intermediate single-file HTML next to the PDF
 *   --keep   do not delete the temporary working directory
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const deckDir = join(root, 'docs', 'deck', 'project');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const outPath = resolve(
  root,
  opt('--out', join('docs', 'Re-imagining-Module-Federation-in-Angular.pdf')),
);

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('No Chrome, Chromium or Edge found. Install one, or export from the artifact instead.');
  process.exit(1);
}

const index = JSON.parse(readFileSync(join(deckDir, 'deck.json'), 'utf8'));

/** Reads one declaration out of an inline style attribute. */
const decl = (style, prop) => {
  const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'));
  return m ? m[1].trim() : null;
};

let connectorCount = 0;

/**
 * The artifact type's connector element, redrawn as SVG. x1/y1/x2/y2 are px from
 * the positioned ancestor, so an overlay SVG with no viewBox maps them 1:1.
 */
function replaceConnector(el, doc, slideId) {
  const style = el.getAttribute('style') ?? '';
  const route = el.getAttribute('route') ?? 'straight';
  if (route !== 'straight') {
    throw new Error(
      `${slideId}: <x-connector route="${route}"> is not supported by this exporter. ` +
        `Add the route here, or straighten the connector in the deck.`,
    );
  }
  const head = el.getAttribute('head') ?? 'end';
  const color = decl(style, 'color') ?? '#9aa6b2';
  const width = Number((decl(style, 'border-width') ?? '2').replace('px', '')) || 2;
  const dashed = (decl(style, 'border-style') ?? '') === 'dashed';
  const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((a) => Number(el.getAttribute(a)));
  if ([x1, y1, x2, y2].some((n) => Number.isNaN(n))) {
    throw new Error(`${slideId}: <x-connector> without x1/y1/x2/y2 is not supported by this exporter.`);
  }

  const id = `xc${connectorCount++}`;
  // markerUnits defaults to strokeWidth, so the head is 4 stroke widths, as the
  // artifact type documents.
  const marker =
    `<marker id="${id}" orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible">` +
    `<path d="M0 0 L4 2 L0 4 Z" fill="${color}" stroke="none"/></marker>`;
  const ends =
    (head === 'end' || head === 'both' ? ` marker-end="url(#${id})"` : '') +
    (head === 'both' ? ` marker-start="url(#${id})"` : '');

  const svg = doc.createElement('div');
  svg.innerHTML =
    `<svg style="position:absolute; left:0; top:0; width:100%; height:100%; overflow:visible" ` +
    `xmlns="http://www.w3.org/2000/svg"><defs>${marker}</defs>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ` +
    `stroke-linecap="round" stroke-linejoin="round"${dashed ? ' stroke-dasharray="12 10"' : ''}${ends}/></svg>`;
  el.replaceWith(svg.firstChild);
}

const sections = [];
for (const id of index.order) {
  const file = join(deckDir, 'slides', `${id}.html`);
  if (!existsSync(file)) throw new Error(`deck.json lists "${id}" but ${file} does not exist.`);
  const dom = new JSDOM(readFileSync(file, 'utf8'));
  const doc = dom.window.document;
  const section = doc.querySelector('section');
  if (!section) throw new Error(`${id}: no <section>.`);
  for (const aside of section.querySelectorAll('aside')) aside.remove();
  for (const c of [...section.querySelectorAll('x-connector')]) replaceConnector(c, doc, id);
  sections.push(section.outerHTML);
}

const fonts = Object.values(index.faces ?? {})
  .map((f) => `<link rel="stylesheet" href="${f.href}">`)
  .join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${index.title}</title>
${fonts}
<style>
  @page { size: 1920px 1080px; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #111317; }
  p, h1, h2, h3, h4, ul, ol, li, table, figure { margin: 0; }
  table { border-collapse: collapse; }
  aside { display: none !important; }
  section {
    position: relative;
    width: 1920px; height: 1080px;
    overflow: hidden;
    break-after: page; page-break-after: always;
  }
  section:last-of-type { break-after: auto; page-break-after: auto; }
</style></head>
<body>
${sections.join('\n')}
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

console.log(
  `${outPath.replace(root + '/', '')} — ${sections.length} slides, ${connectorCount} connectors redrawn`,
);
