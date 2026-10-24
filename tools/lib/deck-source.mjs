/**
 * Reads the deck under `docs/deck/` once, for every exporter.
 *
 * `docs/deck/` is the source of truth: `project/deck.json` holds the order and the
 * web fonts, and `project/slides/<id>.html` holds one `<section>` per slide, in the
 * Slides artifact format (1920 x 1080, inline styles only).
 *
 * Two things are normalised here, because every exporter needs them done and none
 * of them should do it differently:
 *
 * - `<aside>` speaker notes are lifted out of the markup and returned separately.
 * - `<x-connector>` is an element of the Slides artifact type, so nothing outside
 *   that artifact can draw it. It is redrawn as inline SVG. Only what the deck
 *   actually uses is supported; anything else throws, so a connector is never
 *   silently rendered wrong.
 */

import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { join } from 'node:path';

/** Reads one declaration out of an inline style attribute. */
const decl = (style, prop) => {
  const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'));
  return m ? m[1].trim() : null;
};

/** Inline text of an element, with <br> as an em dash and whitespace collapsed. */
export function text(el) {
  const clone = el.cloneNode(true);
  for (const br of clone.querySelectorAll('br'))
    br.replaceWith(clone.ownerDocument.createTextNode(' — '));
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

/**
 * The artifact type's connector element, redrawn as SVG. x1/y1/x2/y2 are px from
 * the positioned ancestor, so an overlay SVG with no viewBox maps them 1:1.
 */
function replaceConnector(el, doc, slideId, seq) {
  const style = el.getAttribute('style') ?? '';
  const route = el.getAttribute('route') ?? 'straight';
  if (route !== 'straight') {
    throw new Error(
      `${slideId}: <x-connector route="${route}"> is not supported by the exporters. ` +
        `Add the route in tools/lib/deck-source.mjs, or straighten the connector in the deck.`,
    );
  }
  const head = el.getAttribute('head') ?? 'end';
  const color = decl(style, 'color') ?? '#9aa6b2';
  const width = Number((decl(style, 'border-width') ?? '2').replace('px', '')) || 2;
  const dashed = (decl(style, 'border-style') ?? '') === 'dashed';
  const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((a) => Number(el.getAttribute(a)));
  if ([x1, y1, x2, y2].some((n) => Number.isNaN(n))) {
    throw new Error(`${slideId}: <x-connector> without x1/y1/x2/y2 is not supported by the exporters.`);
  }

  const id = `xc${seq}`;
  // markerUnits defaults to strokeWidth, so the head is 4 stroke widths, as the
  // artifact type documents.
  const marker =
    `<marker id="${id}" orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible">` +
    `<path d="M0 0 L4 2 L0 4 Z" fill="${color}" stroke="none"/></marker>`;
  const ends =
    (head === 'end' || head === 'both' ? ` marker-end="url(#${id})"` : '') +
    (head === 'both' ? ` marker-start="url(#${id})"` : '');

  const holder = doc.createElement('div');
  holder.innerHTML =
    `<svg style="position:absolute; left:0; top:0; width:100%; height:100%; overflow:visible" ` +
    `xmlns="http://www.w3.org/2000/svg"><defs>${marker}</defs>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ` +
    `stroke-linecap="round" stroke-linejoin="round"${dashed ? ' stroke-dasharray="12 10"' : ''}${ends}/></svg>`;
  el.replaceWith(holder.firstChild);
}

/**
 * @returns {{ index: object, slides: Array<{
 *   id: string, title: string, style: string, transition: string|null,
 *   body: string, outerHTML: string, notes: string
 * }>, connectors: number }}
 */
export function loadDeck(deckDir) {
  const index = JSON.parse(readFileSync(join(deckDir, 'deck.json'), 'utf8'));
  let connectors = 0;
  const slides = [];

  for (const id of index.order) {
    const file = join(deckDir, 'slides', `${id}.html`);
    if (!existsSync(file)) throw new Error(`deck.json lists "${id}" but ${file} does not exist.`);
    const dom = new JSDOM(readFileSync(file, 'utf8'));
    const doc = dom.window.document;
    const section = doc.querySelector('section');
    if (!section) throw new Error(`${id}: no <section>.`);

    const aside = section.querySelector(':scope > aside');
    const notes = aside
      ? aside.textContent.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
      : '';
    for (const a of section.querySelectorAll('aside')) a.remove();
    for (const c of [...section.querySelectorAll('x-connector')])
      replaceConnector(c, doc, id, connectors++);

    const heading = section.querySelector('h1, h2, h3');
    slides.push({
      id,
      title: heading ? text(heading) : '(no heading)',
      style: section.getAttribute('style') ?? '',
      transition: section.getAttribute('data-transition'),
      body: section.innerHTML.trim(),
      outerHTML: section.outerHTML,
      notes,
    });
  }

  return { index, slides, connectors };
}

/**
 * The deck's body font. Almost every element names its own font inline, but a
 * handful inherit — and with no base font declared they fall back to the browser
 * default, which is a serif. One serif paragraph among twenty-two sans ones is
 * very visible, so the exporters declare this and nothing can quietly fall through.
 */
export const BODY_FONT = "'Open Sans', Verdana, sans-serif";

/**
 * The shared reset. The slides are absolutely laid out with inline styles, so an
 * exporter must not impose margins, and must let every declared background paint.
 */
export const RESET_CSS = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ${BODY_FONT}; }
  p, h1, h2, h3, h4, ul, ol, li, table, figure { margin: 0; }
  table { border-collapse: collapse; }
`;
