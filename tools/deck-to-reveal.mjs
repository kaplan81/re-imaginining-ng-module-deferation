#!/usr/bin/env node
/**
 * Renders the deck under `docs/deck/` as ONE self-contained reveal.js page.
 *
 * Two jobs, and they want the same file:
 *
 * 1. **Presenting without anything installed.** Open it in any browser, press F
 *    for full screen, arrow keys to advance. reveal.js, its stylesheet and the
 *    three web fonts are all inlined, so it works with the network off — which a
 *    conference room cannot promise and a PDF already survives, but this keeps the
 *    deck's real layout and its transitions.
 * 2. **Importing into slides.com.** slides.com reads reveal.js markup: one
 *    `<section>` per slide inside `.reveal > .slides`, with speaker notes in
 *    `<aside class="notes">`. That is exactly what this writes. Import fidelity is
 *    still slides.com's business, not ours — the slides are absolutely positioned
 *    on a 1920 x 1080 canvas, so anything that re-flows them will move things.
 *
 * Why the slide markup is wrapped. The deck's own `<section>` elements carry inline
 * `display:flex`, and reveal shows and hides slides by setting `display` on the
 * sections it owns — an inline value would beat it and every slide would be
 * visible at once. So reveal gets a bare `<section>`, and the deck's section
 * becomes a `<div class="deck-slide">` inside it, keeping its id and its styles.
 *
 * Usage: node tools/deck-to-reveal.mjs [--out <path>] [--no-fonts]
 *   --no-fonts   link the Google Fonts stylesheets instead of embedding them
 *                (much smaller file, but then it needs the network)
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { loadDeck, RESET_CSS } from './lib/deck-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => (argv.indexOf(n) >= 0 && argv[argv.indexOf(n) + 1]) || d;

const outPath = resolve(root, opt('--out', join('docs', 'Re-imagining-Module-Federation-in-Angular.html')));
const revealDir = join(root, 'node_modules', 'reveal.js', 'dist');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Google serves a different stylesheet per browser; ask as a current Chrome so it
 * answers with woff2, then pull each font file in and base64 it into the CSS.
 * Only the latin subsets are kept — the deck is English plus "Zürich".
 */
async function embedFonts(faces) {
  const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  let css = '';
  let files = 0;
  for (const face of faces) {
    const sheet = await (await fetch(face.href, { headers: { 'User-Agent': UA } })).text();
    for (const block of sheet.split(/(?=\/\*)/)) {
      if (!/\/\*\s*latin(-ext)?\s*\*\//.test(block)) continue;
      const url = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
      if (!url) continue;
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      css += block.replace(/url\(https:[^)]+\.woff2\)/, `url(data:font/woff2;base64,${buf.toString('base64')})`);
      files++;
    }
  }
  return { css, files };
}

const { index, slides, connectors } = loadDeck(join(root, 'docs', 'deck', 'project'));
const faces = Object.values(index.faces ?? {});

let fontCss = '';
let fontLinks = '';
let fontFiles = 0;
if (flag('--no-fonts')) {
  fontLinks = faces.map((f) => `<link rel="stylesheet" href="${f.href}">`).join('\n');
} else {
  try {
    ({ css: fontCss, files: fontFiles } = await embedFonts(faces));
  } catch (err) {
    console.warn(`! could not embed fonts (${err.message}); linking them instead — the file will need the network.`);
    fontLinks = faces.map((f) => `<link rel="stylesheet" href="${f.href}">`).join('\n');
  }
}

// reveal supports none|fade|slide|convex|concave|zoom; the deck also uses "push".
const transition = (t) => (t === 'fade' ? 'fade' : 'slide');

const sections = slides
  .map((s) => {
    const notes = s.notes
      ? `\n  <aside class="notes">${s.notes.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('')}</aside>`
      : '';
    return (
      `<section data-transition="${transition(s.transition)}">\n` +
      `  <div class="deck-slide" id="${s.id}" style="${s.style}">${s.body}</div>${notes}\n` +
      `</section>`
    );
  })
  .join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${index.title}</title>
${fontLinks}
<style>${fontCss}</style>
<style>${readFileSync(join(revealDir, 'reveal.css'), 'utf8')}</style>
<style>
  ${RESET_CSS}
  html, body, .reveal-viewport { background: #111317; }
  /* reveal centres its slide text; this deck lays everything out itself */
  .reveal .slides { text-align: left; }
  .reveal .slides > section { padding: 0; }
  .reveal .slides > section > .deck-slide {
    position: relative;
    width: 1920px; height: 1080px;
    overflow: hidden;
  }
</style></head>
<body>
<div class="reveal"><div class="slides">
${sections}
</div></div>
<script>${readFileSync(join(revealDir, 'reveal.js'), 'utf8')}</script>
<script>
  Reveal.initialize({
    width: 1920, height: 1080, margin: 0, minScale: 0.1, maxScale: 4,
    center: false, controls: false, progress: false,
    hash: true, transition: 'slide', transitionSpeed: 'fast',
  });
</script>
</body></html>
`;

writeFileSync(outPath, html);
const kb = Math.round(statSync(outPath).size / 1024);
console.log(
  `${outPath.replace(root + '/', '')} — ${slides.length} slides, ${connectors} connectors redrawn, ` +
    `${fontFiles ? `${fontFiles} font files embedded` : 'fonts linked'}, ${kb} KB`,
);
