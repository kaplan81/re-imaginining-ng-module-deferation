#!/usr/bin/env node
/**
 * Renders the deck under `docs/deck/` as one readable document, `docs/NARRATION.md`:
 * every slide's on-screen content plus its speaker notes, with word counts and
 * spoken-time estimates.
 *
 * Why this exists: a deck is hard to review. The slides are a visual medium and
 * the narration lives in speaker notes you have to click into one at a time. This
 * flattens both into a single file you can read top to bottom, diff, and quote
 * from — and because it is GENERATED from the slide files, it cannot drift away
 * from what the deck actually says.
 *
 * `docs/deck/` is the source of truth. Edit the slides there, publish from there,
 * and regenerate this afterwards. Never hand-edit `docs/NARRATION.md`: say what you
 * want changed and the change goes into the slide.
 *
 * Speaking rate: 140 words per minute, a measured conference pace. Stage
 * directions in [square brackets] are not spoken, so they are excluded from the
 * count.
 *
 * Usage: node tools/deck-to-narration.mjs [--rate 140]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const deckDir = join(root, 'docs', 'deck', 'project');
const outPath = join(root, 'docs', 'NARRATION.md');

const args = process.argv.slice(2);
const RATE = Number(args[args.indexOf('--rate') + 1]) || 140;

const index = JSON.parse(readFileSync(join(deckDir, 'deck.json'), 'utf8'));

/** Inline text of an element, with <br> as an em dash and whitespace collapsed. */
function text(el) {
  const clone = el.cloneNode(true);
  for (const br of clone.querySelectorAll('br'))
    br.replaceWith(clone.ownerDocument.createTextNode(' — '));
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

const styleOf = (el) => el.getAttribute('style') ?? '';
const isPinned = (el) => /position\s*:\s*absolute/.test(styleOf(el));
const topOf = (el) => parseInt((styleOf(el).match(/top\s*:\s*(-?\d+)px/) ?? [0, '0'])[1], 10);
const leftOf = (el) => parseInt((styleOf(el).match(/left\s*:\s*(-?\d+)px/) ?? [0, '0'])[1], 10);

/** A diagram: a relative box holding several pinned children. */
function isFigure(el) {
  if (el.tagName.toLowerCase() !== 'div') return false;
  if (!/position\s*:\s*relative/.test(styleOf(el))) return false;
  // x-connector is placed by x1/y1/x2/y2 attributes, not position:absolute
  const placed = [...el.children].filter(
    (c) => isPinned(c) || c.tagName.toLowerCase() === 'x-connector',
  );
  return placed.length >= 2;
}

/** An all-caps tracked label. */
function isEyebrow(el) {
  const s = styleOf(el);
  return el.tagName.toLowerCase() === 'p' && /text-transform\s*:\s*uppercase/.test(s);
}

function describeFigure(el, out) {
  const pinned = [...el.children].filter(
    (c) => isPinned(c) || c.tagName.toLowerCase() === 'x-connector',
  );
  const connectors = pinned.filter((c) => c.tagName.toLowerCase() === 'x-connector');
  const labelled = pinned
    .filter((c) => c.tagName.toLowerCase() !== 'x-connector' && text(c))
    .sort((a, b) => topOf(a) - topOf(b) || leftOf(a) - leftOf(b));

  out.push(
    `- **Figure** — ${labelled.length} labelled elements, ${connectors.length} connectors, in reading order (top to bottom, left to right):`,
  );
  for (const box of labelled) out.push(`    - ${text(box)}`);
}

function walk(el, out) {
  for (const child of el.children) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'aside') continue;

    if (isFigure(child)) {
      describeFigure(child, out);
      continue;
    }
    if (/^h[1-3]$/.test(tag)) {
      out.push(`- **${tag.toUpperCase()}** ${text(child)}`);
      continue;
    }
    if (tag === 'p') {
      const body = text(child);
      if (!body) continue;
      out.push(isEyebrow(child) ? `- *(eyebrow)* ${body}` : `- ${body}`);
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      for (const li of child.querySelectorAll('li')) out.push(`    - ${text(li)}`);
      continue;
    }
    if (tag === 'table') {
      for (const tr of child.querySelectorAll('tr')) {
        const cells = [...tr.children].map((c) => text(c));
        out.push(`    | ${cells.join(' | ')} |`);
      }
      continue;
    }
    if (tag === 'img') {
      out.push(`- **Image** — ${child.getAttribute('alt') || '(no alt)'}`);
      continue;
    }
    if (tag === 'div') {
      walk(child, out);
      continue;
    }
  }
}

/** Words actually spoken: stage directions in [brackets] do not count. */
function spokenWords(notes) {
  return notes
    .replace(/\[[^\]]*\]/gs, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

const mmss = (minutes) => {
  const total = Math.round(minutes * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// section id -> the slide it starts at
const sectionStart = new Map();
for (const [key, sec] of Object.entries(index.sections ?? {}))
  sectionStart.set(sec.start, { key, ...sec });

const slides = [];
for (const id of index.order) {
  const file = join(deckDir, 'slides', `${id}.html`);
  if (!existsSync(file)) {
    slides.push({ id, missing: true });
    continue;
  }
  const dom = new JSDOM(readFileSync(file, 'utf8'));
  const section = dom.window.document.querySelector('section');
  const aside = section?.querySelector(':scope > aside');
  const notes = aside
    ? aside.textContent
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : '';
  const heading = section?.querySelector('h1, h2, h3');
  const onScreen = [];
  if (section) walk(section, onScreen);

  slides.push({
    id,
    title: heading ? text(heading) : '(no heading)',
    transition: section?.getAttribute('data-transition') ?? '—',
    onScreen,
    notes,
    words: spokenWords(notes),
  });
}

const totalWords = slides.reduce((a, s) => a + (s.words ?? 0), 0);
const totalMin = totalWords / RATE;

const L = [];
L.push(`# ${index.title} — full narration`);
L.push('');
L.push(
  `Generated by \`node tools/deck-to-narration.mjs\` from \`docs/deck/\`, which is the source of truth for the deck. ` +
    `**Do not hand-edit this file** — change the slide and regenerate.`,
);
L.push('');
L.push(
  `Timings assume **${RATE} words per minute**, a measured conference pace. Stage directions in [brackets] are not counted.`,
);
L.push('');
L.push(`**${slides.length} slides · ${totalWords} spoken words · about ${mmss(totalMin)}**`);
L.push('');
L.push('| # | Slide | Title | Words | Time |');
L.push('| --- | --- | --- | --- | --- |');
slides.forEach((s, i) => {
  L.push(
    `| ${i + 1} | \`${s.id}\` | ${s.missing ? '**MISSING FILE**' : s.title} | ${s.words ?? 0} | ${mmss((s.words ?? 0) / RATE)} |`,
  );
});
L.push('');
L.push('---');
L.push('');

slides.forEach((s, i) => {
  const sec = sectionStart.get(s.id);
  if (sec) {
    L.push(`# ${sec.description}`);
    L.push('');
  }
  L.push(`## ${i + 1} · \`${s.id}\` — ${s.missing ? '**MISSING FILE**' : s.title}`);
  L.push('');
  if (s.missing) {
    L.push('> This slide is in `order` but has no file.');
    L.push('');
    return;
  }
  L.push(`*Transition: ${s.transition}*`);
  L.push('');
  L.push('**On screen**');
  L.push('');
  L.push(...(s.onScreen.length ? s.onScreen : ['- *(nothing)*']));
  L.push('');
  L.push(`**Spoken — ${s.words} words, about ${mmss(s.words / RATE)}**`);
  L.push('');
  L.push(s.notes ? s.notes : '*(no speaker notes)*');
  L.push('');
  L.push('---');
  L.push('');
});

writeFileSync(outPath, L.join('\n'));
console.log(
  `docs/NARRATION.md — ${slides.length} slides, ${totalWords} spoken words, about ${mmss(totalMin)} at ${RATE} wpm`,
);
