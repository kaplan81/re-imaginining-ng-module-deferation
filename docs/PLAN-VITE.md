# Build 3 — Vite + Module Federation

Third of the three builds in the talk. Same product, same application code, a
pipeline built on **Vite** with `@analogjs/vite-plugin-angular` and
`@module-federation/vite`.

Status: **implemented and verified.** Code in [`builds/vite/`](../builds/vite).

---

## 1. What was built

All five applications — shell, `catalog`, `orders`, `top-lots`, `roast-queue` —
compiled by Vite and composed at runtime by Module Federation.

| Application   | Role        | Exposes     | Build 1 | Build 2 | Build 3 |
| ------------- | ----------- | ----------- | ------- | ------- | ------- |
| `shell`       | host        | —           | 4200    | 4210    | 5173    |
| `catalog`     | page remote | `./Routes`  | 4201    | 4211    | 5174    |
| `orders`      | page remote | `./Routes`  | 4202    | 4212    | 5175    |
| `top-lots`    | widget MFE  | `./Widgets` | 4203    | 4213    | 5176    |
| `roast-queue` | widget MFE  | `./Widgets` | 4204    | 4214    | 5177    |

All three pipelines can run at once — `npm run start:everything` — which is a
demo in itself. The canonical port map lives in the
[root README](../README.md#every-port).

```bash
npm run build:vite:all        # all five, production
npm run start:vite:all    # all five dev servers
npm run preview:vite:all      # serve the built output
```

## 2. Why this needs a third-party plugin at all

Worth a slide of its own, because it is the cleanest illustration of the talk's
thesis.

Angular's `application` builder **already uses Vite** — for the dev server. But
that Vite instance is _encapsulated_ by the Angular CLI: there is no
`vite.config.ts` to put plugins into, so `@module-federation/vite` cannot reach
it. Angular's own [custom build pipeline
docs](https://angular.dev/ecosystem/custom-build-pipeline) say to prefer the CLI
"to leverage its structure-dependent update functionality and build system
abstraction", name module federation as one of the rare reasons to leave it, and
point at the AnalogJS plugin and the Rspack plugin as the two community routes —
adding, in as many words, that community tools mean manual maintenance and no
automated update experience. Builds 2 and 3 are those two routes.

So: "Angular uses Vite" and "you can use Vite with Angular" are different claims.
This build is the second one.

## 3. Verified version constraints

Re-verified against npm on 2026-09-06. Unlike the Rspack path, **nothing here
blocks Angular 22** — this was the smoothest of the three pipelines to stand up.

| Package                         | Latest   | Peer range                                          | Verdict for Angular 22 |
| ------------------------------- | -------- | --------------------------------------------------- | ---------------------- |
| `@analogjs/vite-plugin-angular` | `2.7.1`  | `vite ^6 \|\| ^7 \|\| ^8`, `@angular/build ^18–^22` | **Supported**          |
| `@module-federation/vite`       | `1.21.3` | `vite ^5 \|\| ^6 \|\| ^7 \|\| ^8`                   | **Supported**          |
| `vite`                          | `8.2.2`  | —                                                   | matches both plugins   |

Two things the Rspack build paid for and this one did not:

- **No peer-dependency fight.** `npm i -D @analogjs/vite-plugin-angular @module-federation/vite vite`
  installed clean. Build 2's adapter forced an Angular patch bump across the
  whole workspace and a full lockfile re-resolve.
- **No phantom peers.** `@nx/angular-rspack` hard-requires `@angular/ssr`, and
  through it `@angular/platform-server`, for a browser-only build. Analog
  requires neither.

## 4. Findings

### 4.1 What Vite gets right that Rspack did not

Build 2 hit six defaults that were silently incompatible with federation — four
in the build, two more that only appear under `rspack serve`. **None of the six
exists here.**

| Build 2 problem                                                    | Build 3                                                                                                                                            |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `import.meta.url` replaced with the build machine's `file://` path | **Not an issue.** Vite emits real ES modules and `import.meta.url` survives. Build 2 needs `tools/remote-origin.ts`; there is no counterpart here. |
| `Cannot use 'import.meta' outside a module` — MF's `var` container | **Not an issue.** `mf-manifest.json` records `remoteEntry.type: "module"` on its own; no `library: { type: 'module' }` needed.                     |
| `Library name base (top-lots) must be a valid identifier`          | **Not an issue.** No global to name, so kebab-case project names are fine.                                                                         |
| `runtimeChunk: 'single'` guts the container                        | **Not an issue.** No equivalent default.                                                                                                           |
| Lazy compilation hangs a remote's second lazy level (dev)          | **Not an issue.** Vite has no compile-on-request stubs.                                                                                            |
| A remote's dev client reload-loops the host page (dev)             | **Not an issue.** Vite's HMR client is a per-origin websocket with no compilation hash to go stale.                                                |

The seam module makes the same point from the other side.
`builds/vite/shell/src/seam/remote.util.ts` is a character-for-character copy of
build 2's apart from the import specifier — `@module-federation/runtime` versus
`@module-federation/enhanced/runtime`, two entry points onto the same 2.9.0
runtime. **Swapping the bundler changed that file not at all; swapping the
federation runtime is what rewrote it.** The two axes the talk keeps separate
really are separate.

### 4.2 Vite does not read tsconfig `paths`

`@rr/catalog/catalog.routes` type-checks and then fails at bundle time with
`Rolldown failed to resolve import`. Build 2's adapter feeds the tsconfig to the
bundler's resolver, so `paths` govern both; Vite treats them as a TypeScript-only
concept.

`tools/aliases.ts` derives Vite's `resolve.alias` from the same tsconfig the
compiler reads, so the two are declared twice but never _written_ twice. The
usual alternative is `vite-tsconfig-paths` — a fourth-party dependency to make two
first-party tools agree about where files are.

### 4.3 Analog's defaults will quietly drop your compiler options

Two options that are easy to miss and fail without an error:

- **`tsconfig`** — Analog looks for `tsconfig.app.json`, and when it is missing it
  logs `Unable to resolve tsconfig … This causes compilation issues` and then
  compiles anyway, silently without `strictTemplates` and the rest of
  `angularCompilerOptions`.
- **`inlineStylesExtension: 'scss'`** — component `styles:` blocks in this
  workspace start with `@use 'tokens'`. Without this they are parsed as CSS. The
  symptom is not an error; it is a component chunk that is suspiciously small
  (13 kB instead of 41 kB) and a page with no styling.

`css.preprocessorOptions.scss.loadPaths` is the equivalent of the CLI's
`stylePreprocessorOptions.includePaths`, and it works as documented.

### 4.4 `@module-federation/vite` does not prune unused shares — 54% of the bundle

The sharpest finding of this build, and it is a size result.

Every declared share gets a `__prebuild__` fallback chunk emitted into every
application — the local copy used if the share scope cannot supply one. The
plugin emits one per _declared_ share, not per _used_ share. Sharing everything
in `dependencies`, the way `shareAll` does, therefore put a **607 kB
`@angular/compiler`** and a **66 kB `@angular/forms`** into all five `dist/`
folders, for packages this product never loads.

Both other pipelines prune automatically: build 1's `shareAll` has
`ignoreUnusedDeps` on by default, and build 2's Rspack plugin only emits a share
for a module something actually consumed.

Pruning by hand — an `unusedAtRuntime` set plus a per-app `omit` for
`@angular/router` in the two widget MFEs, which have no router — took `top-lots`
from **1452 kB to 674 kB**, and made build 3 the smallest of the three on disk.

That fix is also a trap, and the talk should say so: add a Signal Form to a
remote and the build will quietly not share `@angular/forms` until someone
remembers to edit that line. It is the same class of problem as the hand-written
share map, one level further in.

### 4.5 The host preloads all of Angular from `index.html`

`hostInitInjectLocation` defaults to `'html'`, which injects the host's federation
init as eager `<script>`/`<link rel=modulepreload>` tags — and with it every
shared package, before Angular has been asked for. The shell's `index.html`
eagerly referenced **234 kB gzip**.

`hostInitInjectLocation: 'entry'` moves it into the entry module, which `main.ts`
already keeps behind an async `import('./bootstrap')`. That drops the eager
references to **1.5 kB gzip**.

Be precise about what this buys: the _total_ bytes to render the home page barely
move (792 kB → 791 kB raw), because the shell needs Angular either way. What
changes is that nothing is render-blocking before the application asks for it.

### 4.6 Shared chunks are whole packages

Measured on the shell's home page, raw bytes over the wire (no compression, same
static server for all three):

| Build                        | Transferred | Requests |
| ---------------------------- | ----------- | -------- |
| 1 — Angular CLI + Native Fed | 915 kB      | 36       |
| 2 — Rspack + MF              | **268 kB**  | 26       |
| 3 — Vite + MF                | 791 kB      | 26       |

Build 3's largest single chunk is **498 kB** and contains `@angular/core` _and_
`@angular/common` together — `@angular/core` gets no share chunk of its own.
Adding the router (105 kB), http (40 kB) and platform-browser (24 kB) shares,
667 kB of the 791 kB is shared Angular.

Build 2 ships far less for the same page, which suggests Rspack's MF emits only
the consumed parts of a shared package where the Vite plugin emits the package.
The plugin does expose experimental `treeShaking` / `injectTreeShakingUsedExports`
options for shares; they were not enabled here, and trying them is the obvious
next experiment rather than a claim this build has tested.

Build 1 being the largest is its own finding: Native Federation resolves shared
packages through an import map, so nothing is tree-shaken across the boundary at
all.

### 4.7 The `optimizeDeps` risk was real, but not the predicted one

The plan predicted a _second_ copy of Angular pre-bundled beside the shared one.
Measured, that does not happen: in dev every `__prebuild__` fallback stays
unfetched, all nine share-provider chunks come from the **host's own origin**, and
the share scope holds exactly one `@angular/core@22.1.5`.

What did happen is a dev-only reload race. Vite discovered Angular's secondary
entry points mid-page-load, re-optimised, forced a reload, and the reload raced
the in-flight graph:

```
[vite] dependencies optimized: @angular/common/http, @angular/core/primitives/di, …
[vite] optimized dependencies changed. reloading
TypeError: Failed to fetch dynamically imported module: …@angular_core_primitives_signals.js
TypeError: provideRouter is not a function
```

A second reload clears it, which is what makes it easy to dismiss as flakiness.
Naming the entry points in `optimizeDeps.include` removes the discovery step.

### 4.8 HMR is off by default

Without `liveReload: true`, every save is a **full page reload** — Vite logs
`page reload`, not `hmr update`. The Angular CLI hot-swaps the component. Turning
it on gives real `hmr update` messages and federated composition still works,
with component styles crossing the boundary correctly (verified by computed
style: the SCSS tokens resolve to `#fdf0e2` / `#a4520b` / `999px` on a component
served by `:5174` into a host on `:5173`).

The caveat is documented at the option: after the first update Analog serves
component styles as external `<link>` URLs instead of inlining them, so in _dev_ a
federated component's CSS is fetched from its own origin rather than travelling
with the module. Dev only — the build output still inlines.

### 4.9 The seam guard was wrong in both builds

Build 2's seam assertion asked "did an _unreplaced original_ reach the module
graph?". That caught the bug it was written for, but the reasoning is circular
and it misses the likelier failure. When the configured path is wrong there is
nothing to compare against: the redirect never matches, the real file compiles
normally under its real name, and the search for the _misspelled_ name finds
nothing.

Verified by deliberately misspelling the path here: the build went green and
`Federation runtime is not ready: initFederation() has not resolved yet` — build
1's Native Federation seam — was sitting in the output bundle.

Both builds now assert the positive (every configured replacement must have
fired) and check `existsSync` on both paths at config time, so a mistyped path
fails twice before it can reach a bundle. Both failure modes were re-tested in
both pipelines.

The Rollup version is also markedly simpler than the Rspack one: `resolveId` is
handed the importer and the specifier and returns the resolved id, so redirecting
is one comparison and one return.

### 4.10 Answers to the plan's two open questions

- **`import '@angular/compiler'` is not needed.** Analog's `jit` option defaults
  to false, so AOT is in effect. All five applications build, serve and compose
  without importing the compiler, exactly as in build 2. The Zephyr examples'
  import is a leftover. It is also worth noting that leaving `@angular/compiler`
  in the _share map_ is what cost 607 kB per app in §4.4.
- **The hand-written `remotes.d.ts` was avoided entirely** — see §5.

## 5. One deliberate deviation from the plan

The plan sketched the idiomatic `@module-federation/vite` seam: static `remotes`
in the plugin, `import('catalog/Routes')` against a hand-written `remotes.d.ts`,
and a `LOADERS` record in `remote.util.ts`.

That version is prettier and strictly weaker, so this build does what build 2
does instead — the host declares `remotes: {}` and `src/main.ts` fetches the same
`federation.manifest.json` asset build 1 uses and calls `registerRemotes`.

Three reasons, in order of weight:

1. **A `LOADERS` record compiles every remote _name_ into the shell**, not just
   its URL. `widget-slots.json` could then no longer introduce a widget
   microfrontend on its own — which is the one architectural property this
   workspace exists to demonstrate.
2. **The `.d.ts` asserts the remote's exports rather than verifying them.** The
   plan says this itself. It buys types that can silently be wrong.
3. **Comparability.** Builds 2 and 3 differ only in bundler; if one registered
   dynamically and the other statically, the "remote URLs: data or compiled" row
   would be measuring the wrong thing.

The registration carries build 2's two fixes forward — lazy `remoteEntry.js`
entries with an explicit `type: 'module'`, registered one remote at a time — which
is why §6's "killing a remote" item passes here too.

## 6. Parity checklist

Verified against the **production build** of all five applications, served
cross-origin on `:5173`–`:5177`, and separately against the dev servers.

- [x] **Both page remotes render in the shell with correct styling.** `/catalog`
      renders 96 lots, `/orders` 56 orders, origin strips reading `:5174` and
      `:5175`. Component styles cross the boundary; no remote `styles.scss` is
      needed. Verified in preview **and** dev.
- [x] **Exactly one `@angular/core` on the page, verified rather than assumed.**
      One version key `22.1.5` in the share scope, and **zero `__prebuild__`
      fallback chunks fetched** — the share scope satisfied every dependency of
      every remote. The functional proof is stronger still: the shell's own
      `createEnvironmentInjector` instantiates components compiled in two other
      applications, which two Angular copies could not survive.
- [x] **Route-scoped `provideHttpClient` still isolates the two mock
      interceptors.** Catalog renders bean data, orders renders order data, and
      the shell provides no HTTP stack.
- [x] **Killing a remote produces the fallback, not a dead router.** With `:5174`
      stopped, `/catalog` renders `RemoteUnavailableComponent`, the header and
      router keep working, `/orders` is unaffected, and the shell still boots.
- [x] **Each remote runs standalone.** Including both widget galleries; the
      widget still starts at `<h3>` under the gallery's `<h1>`.
- [x] **`vite build` output works under `vite preview`, not just in dev.** Every
      item above was checked on the built output; the widget-slot mounting and
      the dev-only findings in §4.7 and §4.8 were checked in both.
- [x] **`optimizeDeps` does not pre-bundle a second `@angular/core` for the
      host.** Checked in dev and in preview — see §4.7.
- [x] **Both widget microfrontends mount into shell slots**, behind their
      `@defer (on viewport)` boundary, with origin strips reading `:5176` and
      `:5177`.

## 7. Known gaps

- **No test target for build 3**, same as build 2. The seam is guarded at build
  time (§4.9); the seam modules have no specs.
- **Shared-package tree-shaking not attempted.** §4.6 — the plugin's
  `treeShaking` options are the obvious next experiment.
- **A remote that comes back up needs a page reload.** Registration happens once,
  before Angular exists. Build 1 has the same property, so this is parity.
- **Zephyr Cloud (step 5) not implemented**, as in build 2.

## 8. What the talk gets from this build

Measured on this machine, five applications, production mode, cold cache.

| Dimension                         | 1 — Angular CLI + Native Fed | 2 — Rspack + MF             | 3 — Vite + MF                    |
| --------------------------------- | ---------------------------- | --------------------------- | -------------------------------- |
| Cold production build, 5 apps     | 8.4 s                        | 10.3 s                      | **8.1 s**                        |
| Incremental rebuild on file save  | ~90 ms, HMR                  | ~80 ms                      | HMR, opt-in (`liveReload`)       |
| Home page transferred (raw)       | 915 kB / 36 req              | **268 kB** / 26 req         | 791 kB / 26 req                  |
| Shell `index.html` eager refs     | 23.6 kB gzip                 | 32.8 kB gzip                | 1.5 kB gzip (234 kB before §4.5) |
| Total JS on disk, `top-lots`      | 766 kB                       | 752 kB                      | **674 kB**                       |
| Lines of build/federation config  | **156**                      | 340                         | 382                              |
| Shared-dep map: derived or manual | derived (`shareAll`)         | manual, generated           | manual, generated + hand-pruned  |
| Unused shares pruned              | automatic                    | automatic                   | **manual** (§4.4)                |
| Remote URLs: data or compiled     | data (manifest asset)        | data, via `registerRemotes` | data, via `registerRemotes`      |
| `import.meta.url` survives        | yes                          | no — needs a `DefinePlugin` | **yes**                          |
| Angular version ceiling           | tracks Angular               | set by the adapter (`<23`)  | none currently (`^18–^22`)       |
| Install friction                  | none                         | forced an Angular bump      | **none**                         |
| `ng update` migration path        | **yes**                      | no                          | no                               |
| `ng test`, budgets, i18n          | **first-party**              | re-solve per feature        | re-solve per feature             |
| Component-level exposure          | one `./Widgets` descriptor   | identical, unmodified       | identical, unmodified            |
| Unload / layered singletons       | not available                | available                   | available                        |

The three-way read, which is the payload of the talk:

- **Against the baseline**, build 3 isolates one variable — who owns the Vite
  instance. Angular already builds with Vite; the moment you need a plugin inside
  it you leave the first-party pipeline and take ownership of the config, the
  upgrade cadence, and everything the CLI was doing for you. The last three rows
  are the whole bill.
- **Against build 2**, "custom pipeline" is not one decision. Vite installed
  clean, tracks Angular, keeps `import.meta.url`, and needed none of build 2's
  four incompatible-defaults fixes — but it prunes nothing, so its share map is
  hand-maintained one level deeper. Same category of choice, materially different
  exposure.
- **Against both**, the baseline is the control: it is the only one of the three
  where Angular's release notes are also your migration guide. It is also the
  slowest to load and the most config-frugal, which is a genuinely mixed result
  and should be presented as one.

### Caveats on the numbers

- Cold-build times are wall clock for the five applications built sequentially.
  All three pipelines parallelise internally.
- Transferred bytes are raw, uncompressed, from the same static server for all
  three, measured with `performance.getEntriesByType('resource')` on the shell's
  home page after the widget slots have mounted. Gzip would compress build 1's
  unshaken Angular more than build 2's split chunks, so the _ratio_ is what to
  quote, not the absolute figures.
- Config lines exclude blank and comment-only lines, and count each pipeline's
  federation and build configuration only.
- Build 2's and build 3's incremental figures are not directly comparable: build
  2 reports a rebuild time in its log, Vite reports an `hmr update` with no
  duration. Both are "fast enough that it is not the deciding factor", which is
  the honest finding.
