# Talk — "Re-imagining Module Federation in Angular"

**NG Poland 2026.** Recorded video, **20–30 minutes including demo**.

Working document for building the deck. **This file is the handoff context**: a new
session should read this first, then `README.md`, then the two plan documents.

- **Title is fixed.** It is what was submitted to the NG Poland organisers.
- **Format:** recorded video, not a live talk. Aim ~26 min.
- **Audience goal:** people leave with the _concepts_, not the inventory.
- **Supersedes `docs/TALK.md`** (the 45-minute Angular Zürich Meetup version,
  removed in the same commit that added this file — recover it from git history
  if you need the original wording).

---

## 1. The thesis

> **Your bundler is becoming a choice. Module Federation is where you can already
> see it. `ngp` is what makes it undeniable.**

The Zürich spine — _"who turns that string into a file?"_ — demotes from headline
to supporting mechanism. The argument now runs:

1. Angular compilation today happens **inside** the bundler, as that bundler's own
   plugin — an esbuild plugin, an Rspack loader, a Vite plugin.
2. So every bundler that is not the CLI's needs a bespoke **Angular adapter**,
   separately written and separately maintained.
3. **The adapter is the tax.** It is where version ceilings live and where
   abandonment happens — `@nx/angular-rsbuild`, last published **4 Jun 2026**,
   still pinned to `@angular/common <21` while `@nx/angular` is at 23.3.0. That is
   why this experiment had to substitute Vite for Rsbuild.
4. Module Federation is the right instrument for seeing this, because MF forces
   you to configure the bundler directly. You cannot hide behind the CLI.
5. Most people believe there is **one** way to bundle MF in Angular. There are at
   least three, and they are measurably different.
6. **`ngp` removes the tax.** Once Angular emits `.ng.ts` as an artifact, a bundler
   needs no Angular knowledge at all — no adapter, no ceiling, no abandonment.

**Framing correction, deliberately baked in:** it is not that Angular _bound_ you
to esbuild — builds 2 and 3 in this repo escape it. It is that every escape route
carries an adapter tax, and `ngp` is what retires it.

### What re-measuring proved (2026-10-20) — full numbers in `tools/measurements.md`

**The deck's most striking number is a measurement artifact.** Slide 6.7 reports
**268 kB** transferred for build 2 and uses it as the headline "Rspack ships least"
figure. Measured properly, build 2's home page transfers **1261.9 kB**. The old
number is build 2's **same-origin** total — it measures 267.4 kB today, a match to
within 1 kB — so it counted only what the shell's own port served and missed
~994 kB arriving from the four remote origins.

The mechanism: cross-origin resources report `decodedBodySize: 0` to the
Performance API unless the server sends `Timing-Allow-Origin`. A measurement taken
without that header undercounts precisely the pipeline that fetches most from
remotes, which is the one the slide was praising. **The 268 kB figure cannot be
reused.**

| Home page, uncompressed | 1 · CLI + NF      | 2 · Rspack         | 3 · Vite          |
| ----------------------- | ----------------- | ------------------ | ----------------- |
| Zürich claim            | 915 kB / 36       | 268 kB / 26        | 791 kB / 26       |
| Measured now            | **779.5 kB** / 37 | **1261.9 kB** / 27 | **826.7 kB** / 28 |

Where build 2's bytes go: every remote ships a **~117 kB `remoteEntry.js`**,
fetched for all four at boot. That is the data-versus-code distinction made
concrete — build 1's `remoteEntry.json` is 6 kB of data; build 2's equivalent is
117 kB of executable container, four times over. `top-lots` adds 511 kB of chunks
pulled at **19–41 ms, `initiatorType: "script"`**, as the ESM container's static
import graph resolves — for a widget **not rendered on that page**.

**Angular sharing is correct, and now verified rather than assumed.** Build 2's MF
share scope holds exactly one `@angular/core`: `from: "shell"`, `useIn: ["shell",
"top-lots"]`. The 628 kB from the widget origin is _not_ a second Angular. Build 1
confirms the same property independently — one `_angular_core.*.js` request, 13
shared entry points hash-identical across all five applications.

**Cold builds: 7.6 / 8.2 / 7.1 s**, each pipeline's own caches cleared, two runs,
both reproduced. Zürich had 8.4 / 10.3 / 8.1 — **the ordering is unchanged**, Vite
fastest and Rspack slowest, on faster hardware and newer versions. Note "cold"
matters here: build 1 keeps ~37 MB of pre-bundled shared packages in
`node_modules/.cache`, and leaving that warm flatters it against a colleague's
first build or CI.

**`top-lots` JS on disk has inverted**: 766 → **644 kB** for build 1, now the
smallest where it used to be the largest (762 / 706 for builds 2 / 3). That change
is confounded between the Angular 22.2 bump and the `denseExternals` configuration
change — they landed in one commit — so isolating it needs an A/B before claiming
credit for either.

**RESOLVED — and it is the best finding of the re-measurement.** Build 2 fetched
511 kB from the `top-lots` origin even though the widget was never mounted. The
cause is the Module Federation **share-scope negotiation**: reading the live share
scope on build 2's shell, **six of the nine shared packages are provided by
`top-lots`, not the shell** — `@angular/common`, `@angular/common/http`,
`@angular/core/primitives/di`, `@angular/core/primitives/signals`, `rxjs` and
`tslib`. Only `@angular/core`, `@angular/platform-browser` and `@angular/router`
come from the host.

The shell ships **byte-identical copies in its own `dist`** — `542.js`,
`common.js`, `65.js`, `597.js` and `178.js` have the same md5 in all three builds —
and downloads them from a widget's origin regardless. `roast-queue`, structurally
identical, registered second, lost every tie and serves nothing but its manifest.
Every remote offers the same versions, so **the winner is whoever registered
first**.

Three consequences, in increasing order of interest:

1. It explains the 268 kB illusion completely: the shell's own origin looked tiny
   _because_ two thirds of its shared dependencies were being served from
   elsewhere. Same-origin measurement plus cross-origin sharing flattered it twice.
2. Builds 1 and 3 do not do this. Build 1's shell serves all its shared chunks from
   its own origin and takes only 4.5–5.7 kB per remote, which is metadata. The
   cross-origin shared-code dependency is specific to Module Federation on Rspack here.
3. **Build 2's host has a hard runtime dependency on a widget microfrontend.** Take
   `top-lots` offline and the shell loses `@angular/common`, `rxjs` and `tslib`.
   Slide 5.3 already says fault isolation is something _you_ write; this is a case
   where federation silently created coupling in the opposite direction — host
   depending on widget, for packages the host already had on disk.

That third point is a better slide than any byte total: same five applications,
same shared versions, and one pipeline quietly makes the shell depend on a widget
for its framework.

One caveat on all three transferred-byte figures: the browser pane used for the
measurement runs as a background page where `IntersectionObserver` never fires, so
the home page's `@defer (on viewport)` widget slots never activate. All three were
measured under that identical condition — the comparison is fair — but they are
"widgets not yet mounted" numbers, not what a user who scrolls will see. Full
method and the share-scope dump are in `tools/measurements.md`.

### Scope — the build, and nothing after it

**Deployment is out of scope.** No Zephyr Cloud, no CDN strategy, no hosting, no
rollback or live-preview story. The Zürich slide's "seamless integration with
Zephyr Cloud" bullet is **cut** — which costs nothing, since
[`PLAN-VITE.md`](PLAN-VITE.md) line 323 records that Zephyr was never actually
implemented in either build.

The talk ends at the artifact: how it is compiled, bundled, and resolved at
runtime. Where those artifacts get hosted is somebody else's talk.

---

## 2. Running order — ~22 slides, ~26 min

| Act                         | Time        | Slides | Beat                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------- | ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 · Hook**                | 0:00–3:30   | 1–4    | The Angular compiler has a **frontend** and a **backend**. One diagram: `ng-analyze` marked Rust, `ng-preprocessor` marked JavaScript. It emits runtime code that goes **straight to a bundler**, so Angular compilation stops living _inside_ the bundler. Therefore your bundler becomes a choice. _"Most people think there's one way to bundle Module Federation in Angular. I built the same product three ways."_ |
| **2 · Why MF is the lens**  | 3:30–8:00   | 5–8    | What MF actually is (separate builds + runtime composition; the five nouns). What it is **not** (not micro-frontends, not an architecture). What micro-frontends really require — DI boundary, style isolation, fault isolation: _you_ write those. Why MF is the right instrument: it makes you configure the bundler directly.                                                                                        |
| **3 · The one mechanism**   | 8:00–12:00  | 9–12   | `import { Component } from '@angular/core'` — who turns that into a file? The kinds of specifier that exist **today**; bare is the problem. Import map vs a loader you ship. The three times: build / load / runtime.                                                                                                                                                                                                   |
| **4 · Three builds + demo** | 12:00–21:00 | 13–17  | The three answers side by side. What each remote ships: **data** vs **executable container**. Who resolves the module. **Demo.** Then four rows of numbers.                                                                                                                                                                                                                                                             |
| **5 · The cost of choice**  | 21:00–25:00 | 18–20  | The adapter is the tax, with the Rsbuild evidence. **Then the share-scope slide: build 2’s shell takes 6 of its 9 shared packages from a widget it already has on disk, so the host depends on a widget for `@angular/common`, `rxjs` and `tslib`.** Real reasons to pick Rspack; why Vite is harder to justify _today_ — and what oxc changes about that.                                                              |
| **6 · Close**               | 25:00–27:00 | 21–22  | Back to `ngp`: when it ships, the tax retires. Repo link, thanks.                                                                                                                                                                                                                                                                                                                                                       |

### What was cut from the Zürich deck, and why

The module-format history — CommonJS/AMD/UMD and the whole "why it existed / why
it is gone" table — because **the audience does not need the lineage** to
understand who resolves a specifier. Also cut: the ESM scopes slide (including the
"how do you declare a module?" taxonomy), the separate module-resolution slide,
the SystemJS "loader you ship" slide (folded into the import-map slide), "build
tools are not bundlers", the Rickabaugh quote slide (its content moves into the
hook), the web-component encapsulation aside, the four-stages figure (the demo now
does that work), and the agenda slide.

**On modules, say only what is true now:** ES modules are what you write and what
ships. CommonJS still exists and you will meet it in Node and in older packages.
That is the whole of it — one slide, no genealogy.

The ten-row numbers table drops to **four rows**: cold build, bytes transferred,
config size, version ceiling.

### Licence to restructure

The Zürich slide order is not binding. Where turning something around makes it land
faster on video, do that. The constraints are: the fixed title, the thesis above,
Rickabaugh's compiler vocabulary, and not betraying the original's substance or
voice.

---

## 3. The compiler — use Rickabaugh's own terms

From **Alex Rickabaugh**'s ViteConf slides and the Angular blog post,
[_An update on Angular's TypeScript 7-powered Compiler_](https://blog.angular.dev/an-update-on-angulars-typescript-7-powered-compiler-9619a35e2b0a)
(Rickabaugh & Mark Techson, 24 Sep 2026). Use his boxes and his words.

**The existing compiler, as he draws it** — two dashed groups, and the labels are
the whole point:

| Group        | Stages                | He labels it                  |
| ------------ | --------------------- | ----------------------------- |
| **Frontend** | `Analyze` → `Resolve` | **Complex · Slower · Global** |
| **Backend**  | `Generate Code`       | **Fast · Local**              |

That asymmetry is the argument in one picture. The frontend needs a whole-program
view — it is the expensive, global half. The backend is per-file and already fast.
**That is why the frontend is the half worth moving to Rust**, and it explains the
hybrid split far better than any prose in the blog post. This is the insight the
hook should carry.

**The new compiler, as he draws it:**

```
tsconfig  →  ng-analyze 🦀  →  Metadata
                                   ↓
                          ng-preprocessor (JS)
                           ↙                ↘
                 Runtime Code        Type-Checking Code
```

- **`ng-analyze`** — Rust (he puts the crab on it). Consumes `tsconfig`, emits
  **Metadata**.
- **`ng-preprocessor`** — JavaScript/Node. Consumes the Metadata and emits
  **Runtime Code** and **Type-Checking Code** (the `.ng.ts` / `.ngtypecheck.ts`
  pair described in the blog post).

Use _these_ names. They match the merged source tree
(`packages/compiler-cli/preprocessor/ng-analyze`) exactly.

**How the analyzer loads** — his third slide, titled "Deployment", meaning how the
Rust binary reaches the toolchain, nothing to do with shipping an app:
**napi-rs**, **WebAssembly**, and **Sidecar (JSON-RPC)**. Three mechanisms, not the
two the blog post mentions. Worth one line at most; it is detail, not argument.

**Only the frontend is Rust.** The backend remains JavaScript and calls the same
template compiler Angular has always had. Longer term Angular is "interested in
adapting" VoidZero's `oxc-angular-compiler` template engine to move more of the
backend across — that has not happened.

This replaces the Zürich deck's "three parts" framing (TypeScript compiler /
template compiler / Ivy renderer). **Two parts, his names, one of them currently
Rust.**

### Do not put Angular's internal component names on a slide

Verified against the repository itself, `packages/compiler-cli/preprocessor/`
(read 2026-10-20), not just the blog:

- The whole prototype directory is "the preprocessor". Its README opens with
  **"Caution — Prototype — External Contributions Not Accepted"** and describes
  "a native AST analysis preprocessor and typecheck block (TCB) generation
  pipeline… Rust-based AST analysis (`ng-analyze`) using oxc with a
  TypeScript-based typechecking coordination layer."
- `ng-analyze/src/` contains `analyzer/`, `evaluator/`, `query/`, `types/`,
  `utils/`, `resource_loader.rs`, `tsconfig_resolution.rs`, `wasm.rs` — **and a
  `compiler/` module**. So the Rust side does more than analysis, and the blog's
  tidy frontend/backend split is a simplification.
- `ngp` names the whole tool; the ViteConf diagram also labels the JavaScript box
  `ng-preprocessor`. "Pre-processor" reads as "runs first", which it does not.

**Two naming traps, so the slide uses neither name.** The ngp slide shows one Rust
box (`ng-analyze`, oxc) and its output — TypeScript files written out — and says
nothing about frontend or backend. That argument was already made on the `phases`
slide, where it belongs; repeating it here only invites the collision.

The internal split is also moving weekly, so anything precise said about it ages
badly. Say what does not: **it writes files instead of rewriting the tree.**

### How it appears in the hook

One diagram, not two. Built on his new-compiler shape, with `ng-analyze` marked
Rust and `ng-preprocessor` marked JavaScript. **Carry the Global/slow vs Local/fast
labels across from his old-compiler slide**, because that pair is what makes the
split make sense in ten seconds. No before/after pair — the contrast lives in the
labels. The figure reappears nowhere else in the deck.

### Claim strength — a direction, not a fact

`ngp` is pre-MVP, the experimental release is targeted for late 2026, and the CLI
integration is a prototype. The hook says this is clearly where Angular is heading
and lets the commit traffic carry the weight. It does **not** assert that bundler
adapters are going away — that conclusion is left standing on the Rsbuild evidence
in Act 5, where it is a measurement rather than a prediction.

**The checkable version, verified 2026-10-20.** The shipped
`@angular/compiler-cli@22.2.3` — the one that builds this repo — contains **no
`preprocessor` directory, no `ng-analyze`, and not one `.wasm` or `.node`
artefact**. PR #71259 carried the label `target: minor`, so it lands in 22.3.0 at
the earliest, and the blog only _aims_ the experimental build at the end of 2026.

So the slide may never say Angular **is** half Rust. It says Angular **is being
rewritten** that way. Put the disproof on the slide rather than in the notes — "the
`@angular/compiler-cli` you installed this morning contains none of it" is a
checkable line that buys credibility for everything after it.

---

## 4. What changed since Zürich (verified 2026-10-19)

**Angular 22 is still the current major** (22.2.3, patched 14 Oct 2026), and this
repo is already on Rspack 2 and Vite 8. The drift was patch-and-minor, not major.
**This bump has now been applied** — the table below is the gap as it stood, kept
because the right-hand column is what the slide cites.

| Package                                  | In repo (HEAD)                         | npm today                                                                        | Gap                                                                |
| ---------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `@angular/core`                          | 22.1.5                                 | 22.2.3                                                                           | minor                                                              |
| `@angular/build` / `cli`                 | 22.1.7                                 | 22.2.x                                                                           | minor                                                              |
| `@angular-architects/native-federation`  | 22.1.2                                 | 22.2.3                                                                           | minor — peers `@angular/build ~22.2.0`, so it moves _with_ Angular |
| `@rspack/core` / `cli`                   | 2.2.2                                  | 2.2.9                                                                            | patch                                                              |
| `@module-federation/enhanced` · `rspack` | 2.9.0                                  | 2.9.2                                                                            | patch                                                              |
| `@module-federation/vite`                | 1.21.3                                 | 1.23.5                                                                           | minor                                                              |
| `vite`                                   | 8.2.2 (Rolldown 1.2.7)                 | 8.3.4                                                                            | minor                                                              |
| `typescript`                             | 6.0.3                                  | **7.0.2**                                                                        | Angular consumes TS 7.1 interop APIs for type-checking only        |
| `@nx/angular-rspack`                     | 23.2.0, peer `@angular/build >=20 <23` | 23.3.0                                                                           | this _is_ the "adapter `<23`" ceiling — confirmed accurate         |
| `@nx/angular-rsbuild`                    | not installed                          | **still 21.2.0**, peer `@angular/common >=19 <21`, last published **4 Jun 2026** | the substitution rationale, now verifiable                         |

### The four things that actually change the talk

**1 · The config-lines row was inverted — and is now reproducible.**
The Zürich deck claims 156 / 340 / 382 lines for CLI / Rspack / Vite. Those numbers
are hard-coded in markdown, are **not reproducible from the tree** under any
counting rule we could find, and they compared unlike things: build 1 counted as
federation config only, builds 2 and 3 counted as their whole config surface.

`tools/count-config.mjs` now counts under an explicitly documented rule, with its
output committed at `tools/count-config.txt` and `tools/count-config.json`:

| Metric                     | 1 · CLI + NF | 2 · Rspack | 3 · Vite |
| -------------------------- | ------------ | ---------- | -------- |
| All config, raw lines      | 991          | **1175**   | 997      |
| Federation config only     | **304**      | 427        | 355      |
| Config files               | 17           | 20         | 20       |
| **Build-tooling packages** | **2**        | **6**      | **4**    |

The old claim's _direction_ survives on the federation-only row — build 1 is
lightest — but **builds 2 and 3 have swapped**: 427 against 355, where the slide
said 340 < 382. Rspack is now the heavier of the two.

Two caveats the counting tool prints and the slide should carry. **Raw** is the fairer
cross-pipeline measure, because build 1's config is JSON (no blank or comment
lines, so ~100% "code") against the others' TypeScript (~40%) — comparing
code-lines flatters the TypeScript pipelines. And build 1's `angular.json` is a
single workspace file covering all five applications that also carries test
targets, schematics and budgets the other two have no equivalent of, which is why
its total looks large beside its federation-only figure.

**Tooling packages — 2 / 6 / 4 — is the most robust of the four**, and the best
candidate for the slide. It cannot drift when someone refactors a tools file, it
needs no counting rule to defend, and it answers what an audience actually asks:
_what do I have to install to get this?_ It also carries the adapter story in the
same breath, because build 2's sixth package is the prerelease.

**The orchestrator's advice has a price tag.** Applying 4.8.0's two
recommendations took the five `federation.config.mjs` files from **185 to 304 raw
lines — +119** — because `includeSecondaries: keepAll` then required nine `skip`
entries per project. A warning about a correctness risk, whose fix costs 119 lines
of configuration, is the most compact illustration in the repo of what
hand-configuring federation costs.

**2 · The Rsbuild caveat hardened into the finding.**
Zürich apologised for substituting Vite because `@nx/angular-rsbuild` could not
build Angular 22. Four months on, `@nx/angular` is at 23.3.0 while the rsbuild
adapter has not published since 4 Jun 2026 and still peers `@angular/common <21`.
"The adapter, not Angular, sets the version ceiling" is no longer a caveat about an
experiment; it is a demonstrated outcome with a date on it. **Promote it rather
than apologise for it.**

**3 · Angular is replacing its compiler frontend with Rust/oxc.** See §3. The
Zürich deck's closing claim — _"The Angular compiler is not a step before the
bundler. It runs inside it, as that bundler's own extension point. No intermediate
folder of compiled JavaScript ever exists."_ — is precisely what `ngp` inverts.

It has shipped into `main`:
[PR #71259](https://github.com/angular/angular/pull/71259), _"integrate hybrid
preprocessor into compiler-cli"_ (atscott, merged by crisbeto 8 Oct 2026, squashed
as `dac7269`), adding `packages/compiler-cli/preprocessor`, the Rust `ng-analyze`
crate with a WASM target, a language-service extension and an experimental
`ngp-vscode-ng-language-service`.

And it has not stopped: **35 commits to that directory between 14 and 19 Oct
2026** — HMR, Bazel WASM/sidecar wiring, `rootDirs` path resolution, `forwardRef`
and standalone self-reference handling, host directives, signal debug names, span
accuracy, source-map memory use, and four commits on 19 Oct alone porting ngtsc's
decorator, component/service, initializer-API and injection/lifecycle validations
across.

**The Zürich "read it carefully" correctives were right.** The hybrid
Rust-frontend/TS-backend split is exactly what landed. That is a four-month-old
prediction with receipts — worth saying out loud.

**4 · TypeScript 7 shipped; this repo stays on 6.** The native Go port went stable
July 2026. The "blocked on tsgo" framing is now wrong — Angular isn't waiting for
TypeScript, it is routing around it.

### What the bump itself proved (2026-10-20) — the headline finding

The repo is now on Angular 22.2.3, Native Federation 22.2.3, Rspack 2.2.9, Vite
8.3.4, `@module-federation/*` 2.9.2 / 1.23.5. All three builds green, 63 tests
passing. Getting there produced better evidence than any slide the Zürich deck had.

**`@nx/angular-rspack` stable does not build against Angular 22.2.3.** Not a
regression in the newest release — **23.2.0 and 23.3.0 fail identically**. Two
distinct breakages, one per code path:

| Path                     | Error                                                                                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parallel (default)       | `DataCloneError: () => compilerOptions could not be cloned` — the adapter passes a function as Angular's compiler-options transformer (`setup-with-angular-compilation.js:84`), and Angular's parallel compilation structured-clones its arguments into a worker thread. |
| `NG_BUILD_PARALLEL_TS=0` | `AssertionError: Hash utility must be initialized by awaiting initializeHash()`. That function exists in `@angular/build` 22.2.3; the adapter never calls it.                                                                                                            |

Both are **private-API changes Angular shipped in a patch-level release**. The
adapter's peer range declares `@angular/build >= 20.0.0 < 23.0.0` — it claims to
support the exact version that breaks it. Meanwhile build 1 (first-party) and
build 3 (`@analogjs/vite-plugin-angular`) bumped without a murmur.

**The fix exists only in a prerelease.** `@nx/angular-rspack@24.0.0-beta.4` builds
clean; it is what this repo now pins. So the honest statement of the version
ceiling is not "adapter `<23`" — it is _to build current Angular with Rspack today
you must run a prerelease adapter_.

This inverts the Zürich conclusion, where Rspack was the credible alternative and
Vite was not. Say that out loud: the talk changed its own mind, and the measurement
is why.

**Native Federation orchestrator 4.8.0 changed shared-externals behaviour.** It now
warns that flat externals can make a remote load its own Angular, because it no
longer stitches a package together from several builds. Acting on the advice cost
three edits per project:

1. `features.denseExternals: true` — groups entry points under their package with
   one `bundle` key, so version negotiation happens once per package rather than
   once per entry point. Verified: all 13 entry points stay hash-identical across
   shell and remotes, `@angular/core` included.
2. `includeSecondaries: { keepAll: true }` extended from `@angular/core` alone to
   `@angular/common`, `@angular/platform-browser` and `@angular/router`.
3. **Nine new `skip` entries** — because `keepAll` publishes _every_ entry point,
   and `@angular/platform-browser/animations` imports `@angular/animations` while
   `@angular/common/upgrade` and `@angular/router/upgrade` import
   `@angular/upgrade`. Neither is installed here, so build 1 failed outright until
   they were skipped. The tool predicted this in its own error NOTE.

That chain — a warning, whose fix breaks the build, whose fix is nine lines of
skip list — is a tidy illustration of what configuring federation by hand costs.

**`tsconfig.federation.json`'s `files` array is now ignored.** The build warns:
_"every build context compiles its own exposes and shared mappings. Remove 'files'
to silence this."_ This **contradicts `AGENTS.md`**, which documents adding an
exposed key as two edits — `federation.config.mjs` plus the `files` array. That
second edit is now dead. Fix `AGENTS.md` before the next person follows it.

### Still true, carried over unchanged

Everything in the Modules track and the mental-model track is standards material
and has not moved.

---

## 5. Material carried from the Zürich talk

### The strongest single piece of evidence — lead Act 4 with it

> `remote.util.ts` and `main.ts` are **identical between builds 2 and 3 except for
> one import specifier** — `@module-federation/enhanced/runtime` versus
> `@module-federation/runtime`, two entry points onto the same 2.9.0 runtime.
> `remote-registry.service.ts` is byte-identical.
>
> **Swapping the bundler changed the application code not at all. Swapping the
> federation runtime is what rewrote it.**

This lands the "two independent axes" distinction in about ten seconds, it is the
cleanest thing the three-build experiment actually proves, and under the new thesis
it is _the_ evidence that your bundler is already a choice. It was buried in §5 of
the Zürich document. Promote it.

### The closing line

> **Build 1 lets the browser resolve modules. Builds 2 and 3 ship JavaScript that
> does it instead.** Everything else — two lazy levels, manifest-as-data, exactly
> one Angular on the page — is the same in all three.

### Do not oversell the speed story

The headline is not the one the marketing suggests: the **Angular CLI is faster
cold**, incremental rebuild is a wash (~90 ms vs ~80 ms), and build 2 ships more
bytes. Angular's builder is already esbuild, so there is no rebuild win left to
take. What a custom pipeline buys is the MF ecosystem; what it costs is the bottom
rows of the table.

If you show transferred bytes, state the caveat: raw and uncompressed, same static
server for all three. **Quote the ratio, not the absolute figures.**

### Findings worth slide time

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
Hand-pruning took `top-lots` from 1452 kB to 674 kB. This is a far more vivid
version of the "manual" cell in the numbers table than the word "manual".

**Three Rspack defaults that are individually reasonable and silently fatal under
federation:** `lazyCompilation: false`, `optimization.runtimeChunk: false`,
`library: { type: 'module' }`.

**`@module-federation/runtime` is imported but undeclared** in root
`package.json` — it resolves only by hoisting. A real fragility worth a line.

### Existing figures

Four figures from the Zürich deck, already drawn:
<https://claude.ai/code/artifact/20785ea5-cd60-4778-bc48-eb6dddacf4af>

Three survive into the video cut and get **rebuilt as inline SVG sized for 1080p,
not for a projector**: _the five nouns_, _who resolves the module_, and _what each
remote ships_. The four-stages table is dropped — the demo does that work now.

---

## 6. Demo runbook

**Network panel is the proof.** This is the segment that makes the abstract
concept visible.

```bash
npm run start:everything      # all 15 dev servers, ~80 seconds
```

- **Start it before recording.** Build 1's five `ng serve`s dominate the ~80 s.
  Do not run it on camera.
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

1. Load the shell at `:4200`. Show the **import map in `<head>`**, written at boot,
   _before Angular is imported_. This is the one thing the whole argument rests on.
2. Navigate to `/catalog`. Watch `remoteEntry.json` fetch, then `Routes.js`. The
   "Rendered by the catalog remote localhost:42xx" strip proves which server
   actually answered.
3. Show `@angular/core` resolved from the import map — **loaded once**, not
   re-downloaded per remote.
4. Switch to `:4210` (Rspack). Same product, different network shape:
   `remoteEntry.js` is _code_, chunks are numeric.
5. Switch to `:5173` (Vite). Real ES modules, relative paths, only shared packages
   routed through a wrapper.
6. Kill one remote → the fallback, not a dead router. The rest keeps working.
7. Edit `widget-slots.json` → a widget MFE appears with **no shell rebuild**.
   This is the architectural payoff; do not skip it if time allows.

---

## 7. Recording and delivery

From <https://ng-poland.pl/pre-recorded>.

| Requirement  | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Resolution   | 1920 × 1080, 16:9, **no black borders**                               |
| Frame rate   | consistent 25 or 30 fps                                               |
| Video        | single MP4, H.264, 8–12 Mbps                                          |
| Audio        | AAC, 48 kHz, 192–320 kbps, steady level, no clipping or echo          |
| Length       | **20–30 minutes**, English                                            |
| Head/tail    | ~2 seconds of clean footage at each end                               |
| Captions     | separate SRT/VTT if supplied — **never burned in**                    |
| Forbidden    | music, conference branding                                            |
| File name    | `Andres-Gesteira-Re-imagining-Module-Federation-in-Angular.mp4`       |
| **Deadline** | **30 October 2026** for review and publication before the conference  |
| Submission   | form on that page, with a download link (Drive, Dropbox, WeTransfer…) |

Capture the screen directly rather than filming a monitor, and enlarge the editor
during the demo.

### The webcam safe zone — a hard layout constraint

The webcam overlay sits **bottom right**, a circle roughly 15% of frame width. The
organisers only say "position it so it does not cover slides", which puts the
burden on the slides.

**Rule: no content inside the bottom-right 460 × 420 block — that is `x ≥ 1460`
and `y ≥ 660` on the 1920 × 1080 canvas.**

In practice, on a deck with 128px margins (content box 1664 × 824 starting at
128,128):

- Anything sitting **below y 660** must end by **x 1460** — so give low paragraphs
  `width:1300px` rather than the full 1664.
- **Full-width rows** (card rows, tables, diagrams) must finish **above y 660**, or
  be narrowed to 1300.
- **Footers** pinned at `bottom:64px` get `width:1240px`, left-aligned.
- A statement slide can still use the full width at the top; it is only the lower
  right that is lost.

This doubles as useful discipline: it enforces the "much less text per slide than
the Zürich deck" rule that a 1080p video needs anyway.

All four Act 1 slides were rebuilt against this rule after it was discovered —
check every new slide against it before publishing.

## 8. Working plan

### 1 · Bump the repo to current — DONE (commit `f53d991`)

Work on a branch. Patch-and-minor drift, not a migration: Angular 22.1.5 → 22.2.3,
Native Federation 22.1.2 → 22.2.3 (keep them in lockstep — the adapter peers
`@angular/build ~22.2.0`), Rspack 2.2.2 → 2.2.9, `@module-federation/vite`
1.21.3 → 1.23.5, Vite 8.2.2 → 8.3.4. **Leave TypeScript on 6.0.3.** Leave
`@nx/angular-rsbuild` alone — its being stuck is the evidence.

Declare `@module-federation/runtime` explicitly rather than relying on hoisting.

Confirm all 15 dev servers come up and all three shells still compose the same five
apps before measuring anything.

### 2 · Make the config-lines metric reproducible — DONE

`tools/count-config.mjs` counts build and federation configuration under a rule
documented in its own header, and prints the caveats that make the numbers
readable. Output is committed at `tools/count-config.txt` (human) and
`tools/count-config.json` (machine). Regenerate with:

```bash
node tools/count-config.mjs > tools/count-config.txt && node tools/count-config.mjs --json > tools/count-config.json
```

Result: **991 / 1175 / 997** raw lines overall, **304 / 427 / 355** for federation
config alone, **17 / 20 / 20** files, **2 / 6 / 4** tooling packages. See §4
finding 1 for how to read them and which to put on the slide.

### 3 · Re-measure the four rows that survive — DONE

`tools/measure-builds.mjs` (cold builds, each pipeline's own caches cleared) and
`tools/serve-dist.mjs` (one static server for all three, `Timing-Allow-Origin`
set) produce the numbers; method and caveats in `tools/measurements.md`.

| Row                    | 1 · CLI + NF                | 2 · Rspack                | 3 · Vite  |
| ---------------------- | --------------------------- | ------------------------- | --------- |
| Cold build, 5 apps     | 7.6 s                       | 8.2 s                     | **7.1 s** |
| Home page transferred  | **779.5 kB**                | 1261.9 kB                 | 826.7 kB  |
| Requests               | 37                          | 27                        | 28        |
| Build-tooling packages | **2**                       | 6                         | 4         |
| Version ceiling        | tracks Angular to the minor | **stable broken on 22.2** | `^18–^22` |

Machine and date are recorded in the output files and must appear on the slide.

### 4 · Write the narration

Rewrite to the six-act structure in §2, drawing prose from §5. Because this is a
recorded video, the narration goes in the deck's **speaker notes**, written to be read
aloud, with demo cues marked inline. Target ~26 minutes at a measured pace.

### 5 · Build the deck — Act 1 done, 18 slides to go

**`docs/deck/` is the source of truth for the deck**, not the published artifact and
not a scratchpad. It holds `project/deck.json` and one `project/slides/<id>.html`
per slide, in the Slides artifact format (1920 × 1080, inline styles only).
Publish from there, with `root` set to `docs/deck`.

**`docs/NARRATION.md` is generated**, never hand-edited:

```bash
node tools/deck-to-narration.mjs        # add --rate 160 for a faster pace
```

It flattens every slide into on-screen content plus speaker notes, with word counts
and spoken-time estimates at 140 wpm, so the whole talk can be read, diffed and
timed as one document. Regenerate it after any slide change. To change wording,
edit the slide and regenerate — never the other way round.

A Slides artifact titled _Re-imagining Module Federation in Angular_ with **NG
Poland 2026** on the title slide. Rebuild the Zürich identity: near-black `#111`
canvas, left-aligned Archivo headlines, Open Sans body, IBM Plex Mono code, blue
accent links.

Keep per-slide text well under what the Zürich deck carried — **at 1080p a viewer
reads perhaps a third of what a room full of people will.**

---

## 9. Verification

- Run all three production builds clean, **twice**, and confirm every captured
  number reproduces before it goes on a slide.
- Bring up all 15 dev servers and walk each of the three shells through
  `/catalog`, `/orders` and both widget slots.
- Rehearse the demo against a **cold cache** and confirm each of the seven network
  beats is actually visible at recording resolution — the import map especially.
- Read the speaker notes aloud end to end and time them. If it runs past 30
  minutes, **cut from Act 3 first**.
- Re-check the `ngp` commit activity and the `@nx/angular-rsbuild` registry row on
  the recording day — both are live and both are load-bearing.

## 10. Open items

- Slides not started. This document is the brief; the deck is not written.
- `docs/ARCHITECTURE.md` is agent-generated prose and has not been re-read against
  the current three-build state — verify before quoting it on a slide.
- [`PLAN-RSBUILD.md`](PLAN-RSBUILD.md) and [`PLAN-VITE.md`](PLAN-VITE.md) both
  still carry the unreproducible 156 / 340 / 382 figures. Fix when §7.2 lands.
