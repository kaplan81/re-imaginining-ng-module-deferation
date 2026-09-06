# Talk — "Module Federation in Angular: beyond the default toolchain"

Working document for building the slides. **This file is the handoff context**: a new
session should read this first, then `README.md`, then the two plan documents.

Everything in §1–§4 was decided in conversation and should not be re-litigated
without a reason. Everything in §5 onward is reference material for slide content.

- **Length:** 45 minutes, including Q&A.
- **Tool:** slides.com — each numbered section below is one _vertical_ stack.
- **Repo state:** clean at `17d3f68`. All three builds green, 63 tests passing.
- **Diagram already produced:** <https://claude.ai/code/artifact/20785ea5-cd60-4778-bc48-eb6dddacf4af>
  (four figures, each sized to screenshot onto a slide — see §7).

---

## 1. Agenda — the agreed running order

The original draft had five blocks and came to **53–62 minutes**. This is the
version that fits. Two structural decisions matter more than the timings:

- **Build tools move to second.** "Kinds of Module Federation" cannot be
  explained before the audience knows what Rspack and Vite are.
- **The MF _variants_ move out of section 3 and into section 4**, where each
  variant simply _is_ one of the three builds. Section 3 then stays pure concept
  and can be short.

| #   | Section                             | Target     | Notes                       |
| --- | ----------------------------------- | ---------- | --------------------------- |
| 1   | Modules                             | **7 min**  | Ruthlessly trimmed — see §2 |
| 2   | Build tools vs bundlers             | **8 min**  |                             |
| 3   | Module Federation as a mental model | **9 min**  | The spine of the talk       |
| 4   | Three implementations               | **9 min**  | MF variants live here       |
| 5   | Demo                                | **10 min** | Minimum to be worth doing   |
| —   | Intro + Q&A                         | **2 min**  |                             |

**Pre-decide the cut line.** At minute 30 with two sections left you want the
decision already made. Drop in this order:

1. The web-component encapsulation caveat (§4 below) — a genuine aside.
2. The production-MF anecdotes (lululemon, in `PLAN-RSBUILD.md` §3.8).
3. Any remaining CommonJS / AMD / UMD detail.

**Do not cut the Oxc slide.** It was on the earlier cut list; the verified quote
in §6 makes it one of the stronger slides in the deck.

---

## 2. Section 1 — Modules (7 min)

The biggest overrun risk in the whole talk, and the one with the least payoff if
over-served. You need the audience to leave with exactly two things:

1. **ESM exists and is what ships today.**
2. **A bare specifier — `from "@angular/core"` — has to be resolved by
   _somebody_.** That question is the entire thesis of the talk.

Everything else is context, not content.

- **One slide** of history: CommonJS, AMD, UMD, why they existed, why they are
  gone. Do not tour them.
- **Import maps** get real time — they are half the punchline. A URL table the
  browser's own module loader consults.
- Land the setup line: _someone has to resolve that specifier — the browser, or
  a piece of JavaScript you shipped._

## 3. Section 2 — Build tools vs bundlers (8 min)

The distinction most of the room does not have, and it is load-bearing for
everything after it.

| Build tool  | Bundler underneath                                                       |
| ----------- | ------------------------------------------------------------------------ |
| Angular CLI | esbuild (+ Vite for the dev server)                                      |
| Rsbuild     | Rspack                                                                   |
| Vite        | **Rolldown** (Vite 8; esbuild is gone from Vite's dependencies entirely) |

Then the layer below that — the Rust toolchains that do parsing and
transformation, which are **not** bundlers:

- **Oxc** is to Rolldown what **SWC** is to Rspack.
- Verifiable in this repo: `@nx/angular-rspack` calls `getSwcTranspilationRules(...)`;
  `@oxc-project/*` sits under `node_modules/vite/node_modules/`.

**The point that must land:** neither Oxc nor SWC understands Angular. They strip
types. All Angular-specific work — AOT, template type-checking, `ɵcmp`
generation — is **ngtsc**, in all three builds. This sets up §6.

Close the section by naming the asymmetry in our own experiment, because it is an
honest caveat rather than a footnote to hide:

> Build 2 configures the **bundler** directly (`rspack.config.ts` + `@rspack/cli`).
> Build 3 configures the **build tool** (`vite.config.ts`), and never touches
> Rolldown. Rsbuild would have been the fair counterpart, but `@nx/angular-rsbuild`
> peers `@angular/common >=19 <21` and cannot build Angular 22.

So the comparison is honest about _bundler + federation runtime_, and slightly
apples-to-oranges about _developer experience_. Say so on the slide.

## 4. Section 3 — Module Federation as a mental model (9 min)

The spine. Give it room.

- **MF is a mental model, not an architecture.** It describes how independently
  built bundles find and share code at runtime.
- **MF is not micro-frontends.** The two get conflated constantly. MF has no
  opinion about UI composition, and it runs server-side too.
- **Micro-frontend requirements are a separate list** from what MF gives you.
- **Federation structure:** host/shell, remotes, `remoteEntry`, `exposes`,
  `shared`.
- **The web-component caveat** (first on the cut line): a _real_ MFE would be
  encapsulated in a web component, which is what lets two remotes run different
  Angular versions. **We deliberately do not demonstrate this, because we do not
  recommend it.** Say the "because" out loud — otherwise it reads as an omission.

Leave the _variants_ for section 4.

## 5. Section 4 — Three implementations (9 min)

Open with the single strongest piece of evidence the experiment produced:

> `remote.util.ts` and `main.ts` are **identical between builds 2 and 3 except
> for one import specifier** — `@module-federation/enhanced/runtime` versus
> `@module-federation/runtime`, two entry points onto the same 2.9.0 runtime.
> `remote-registry.service.ts` is byte-identical.
>
> **Swapping the bundler changed the application code not at all. Swapping the
> federation runtime is what rewrote it.**

That lands the "two independent axes" distinction in about ten seconds, and it is
the cleanest thing the three-build experiment actually proves.

Then the three variants, which are now just the three builds:

1. **Native Federation** — import maps, bare specifiers preserved, the browser
   resolves.
2. **Classic MF on Rspack** — a share scope, a `__webpack_modules__` registry.
3. **Classic MF on Vite/Rolldown** — a share scope, real ES modules throughout.

Use the diagram (§7). Numbers and findings in §8–§9.

## 6. The Oxc quote — read it carefully

Verified text, supplied by Andres (x.com blocks unauthenticated fetches with
HTTP 402, so this could not be retrieved directly):

> **Alex Rickabaugh (@synalx):** "We are actively experimenting with a few
> strategies for tsgo support in Angular. Our current strategy is a more hybrid
> approach - using oxc in Rust to replace our compiler frontend, and connecting
> that to our existing compiler backend in TS."

**Two corrections to the earlier reading of this, both of which change the slide:**

1. It is **not** "Oxc replaces the Angular compiler." It is Oxc replacing the
   compiler **frontend** — parsing and the AST layer — while the **existing
   Angular backend stays in TypeScript**. The Angular-specific codegen is not
   being rewritten in Rust.
2. The driver is **tsgo support** (the native TypeScript compiler), not bundler
   strategy. **The post says nothing about Rspack or about new Angular builders.**
   The earlier speculation that this implies Rspack-based builders is not
   supported by the quote — present it as your own speculation or drop it.

**Why this is a good slide rather than a cuttable aside:** it confirms, from the
Angular team, exactly the layering section 2 sets up — the Rust tools take the
frontend work, the Angular semantics stay where they are. It is the same boundary
your three builds already demonstrate, stated by the people who own it.

---

## 7. The diagram

<https://claude.ai/code/artifact/20785ea5-cd60-4778-bc48-eb6dddacf4af>

Four figures, each meant to be screenshotted onto its own slide:

1. **Build time is the same in all three** — ngtsc runs _inside_ the bundler
   (esbuild plugin / webpack loader / Vite plugin). No intermediate folder of
   compiled JS ever exists.
2. **What each remote ships** — tagged `data` vs `code`. Build 1 ships metadata
   plus plain ESM; builds 2 and 3 add an executable container.
3. **Runtime: who resolves the module** — import map vs share scope, drawn as
   parallel three-step chains so the eye compares horizontally. This is the
   money shot.
4. **Side-by-side table** — four stages, three builds.

Closing line of the deck, and of the diagram:

> **Build 1 lets the browser resolve modules. Builds 2 and 3 ship JavaScript that
> does it instead.** Everything else — two lazy levels, manifest-as-data, exactly
> one Angular on the page — is the same in all three.

---

## 8. Measured numbers

Five applications, production, cold cache, this machine. Full table and caveats in
[`PLAN-VITE.md`](PLAN-VITE.md) §8.

| Dimension                         | 1 · Angular CLI | 2 · Rspack          | 3 · Vite                          |
| --------------------------------- | --------------- | ------------------- | --------------------------------- |
| Cold build, 5 apps                | 8.4 s           | 10.3 s              | **8.1 s**                         |
| Home page transferred (raw)       | 915 kB / 36 req | **268 kB** / 26 req | 791 kB / 26 req                   |
| Shell `index.html` eager refs     | 23.6 kB gz      | 32.8 kB gz          | 1.5 kB gz (234 kB before the fix) |
| Total JS on disk, `top-lots`      | 766 kB          | 752 kB              | **674 kB**                        |
| Lines of build/federation config  | **156**         | 340                 | 382                               |
| Unused shares pruned              | automatic       | automatic           | **manual**                        |
| `import.meta.url` survives        | yes             | **no**              | yes                               |
| Angular version ceiling           | tracks Angular  | adapter (`<23`)     | none (`^18–^22`)                  |
| `ng update` / `ng test` / budgets | **first-party** | re-solve            | re-solve                          |

**Do not oversell the speed story.** The headline is not the one the marketing
suggests: the Angular CLI is _faster_ cold, incremental rebuild is a wash
(~90 ms vs ~80 ms), and build 2 ships more bytes. Angular's builder is already
esbuild, so there is no rebuild win left to take. What a custom pipeline buys is
the MF ecosystem; what it costs is the bottom four rows.

Caveat to state if you show transferred bytes: raw and uncompressed, same static
server for all three. Quote the **ratio**, not the absolute figures.

## 9. Findings worth slide time

Full write-ups: [`PLAN-RSBUILD.md`](PLAN-RSBUILD.md) §3, [`PLAN-VITE.md`](PLAN-VITE.md) §4.

**Build 2 hit seven defaults that were silently incompatible with federation.**
Each failed with an error naming something other than the cause:

1. `runtimeChunk: 'single'` leaves `remoteEntry.js` with no runtime →
   `Cannot read properties of undefined (reading 'call')`.
2. Adapter emits ESM, MF's default container is a global `var` →
   `Cannot use 'import.meta' outside a module`.
3. `var` container requires a JS-identifier name → `top-lots` fails the build.
4. A `mf-manifest.json` entry registers **eagerly** → one dead remote takes the
   whole host down, blank page.
5. `lazyCompilation` (on by default in `rspack serve`) → a remote's second lazy
   level posts its compile-trigger to the _host's_ dev server. **The import never
   settles**, so the route renders an empty outlet — no error, no fallback,
   because a promise that never settles is not a rejection.
6. A remote's dev client rides inside the container into the host's page and
   full-reloads it forever on a stale hash.
7. Global-styles entry hardcoded as "not a module" → ESM inside a classic
   `<script>`, console error on every standalone dev page load.

**Items 5–7 are dev-server-only.** `npm run build:rspack:all` stayed perfectly
green throughout. That is the slide: _a production build proves nothing about the
dev server._

**Build 3 had none of the seven**, but does not prune unused shares — sharing all
of `dependencies` put **607 kB of `@angular/compiler`** into all five bundles.
Hand-pruning took `top-lots` from 1452 kB to 674 kB.

**The seam**, and why it is worth explaining: only two shell files call a
federation runtime, and they are substituted **below the import graph** (a _link
seam_, in Michael Feathers' sense) rather than copied — copying would have
cascaded into six files and quietly weakened the byte-identical claim. The guard
was **wrong twice**, and shipped build 1's Native Federation calls inside a green
build. Both builds now check `existsSync` at config time _and_ assert every
replacement actually fired.

---

## 10. Demo runbook

```bash
npm run start:everything      # all 15 dev servers, ~80 seconds
```

- **Start it before going on stage.** Build 1's five `ng serve`s dominate the
  ~80 s. Do not run it live.
- **Only one stack at a time.** Every `…:all` script is gated on
  `tools/check-ports.mjs`; if a port is busy it names the port, the application
  and the holding process. Read the message, do not debug it.
- **Do not rebuild during the demo.** A dev server either empties (build 2) or
  overwrites with dev artefacts (build 1) that pipeline's `dist/`.
- One `Ctrl-C` stops all fifteen. Output is prefixed `[rspack] [ord]`,
  `[vite] [cat]`.

**Ports** — canonical table in [`README.md`](../README.md#every-port).

| App           | 1        | 2        | 3        |
| ------------- | -------- | -------- | -------- |
| `shell`       | **4200** | **4210** | **5173** |
| `catalog`     | 4201     | 4211     | 5174     |
| `orders`      | 4202     | 4212     | 5175     |
| `top-lots`    | 4203     | 4213     | 5176     |
| `roast-queue` | 4204     | 4214     | 5177     |

**Demo beats, in order:**

1. Three shells, three ports, same product.
2. `/catalog` in each — the "Rendered by the catalog remote localhost:42xx" strip
   proves which server actually answered.
3. Scroll to the widget slots — two widget MFEs mounted into a page the shell
   owns, each from its own origin.
4. Kill one remote → the fallback, not a dead router. The rest keeps working.
5. Edit `widget-slots.json` → a widget MFE appears with **no shell rebuild**.
   This is the architectural payoff; do not skip it.

---

## 11. Open items

- Slides not started. This document is the agenda; the deck is not written.
- The Rsbuild-vs-bundler asymmetry (§3) needs its own honest slide.
- Decide whether the "MF runs server-side too" point gets a slide or a sentence.
- `docs/ARCHITECTURE.md` is agent-generated prose and has not been re-read
  against the current three-build state — verify before quoting it on a slide.
