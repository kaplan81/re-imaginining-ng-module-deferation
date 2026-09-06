# Build 2 — Rspack + Module Federation

Second of the three builds in the talk. Same product, same application code, a
**different build pipeline and a different federation runtime**: Rspack instead of
the Angular CLI application builder, classic Module Federation instead of Native
Federation.

Status: **implemented and verified.** Code in [`builds/rspack/`](../builds/rspack).

> **Rsbuild, and why this is Rspack instead.** The plan was written against
> Rsbuild (the build tool; Rspack is the bundler underneath, the same relationship
> Vite has to Rolldown). The Rsbuild adapter, `@nx/angular-rsbuild`, peers
> `@angular/common >=19 <21` and is stuck there — it cannot build this Angular 22
> workspace. Its successor `@nx/angular-rspack` peers `@angular/build >=20 <23`
> and can, so this build talks to Rspack directly through `rspack.config.ts`. That
> substitution is itself the first finding: **the adapter, not Angular, sets the
> version ceiling**, and the two adapters are two majors apart in how far behind
> they are.

---

## 1. What was built

All five applications — shell, `catalog`, `orders`, `top-lots`, `roast-queue` —
compiled by Rspack and composed at runtime by Module Federation.

| Application   | Role        | Exposes     | Build 1 port | Build 2 port |
| ------------- | ----------- | ----------- | ------------ | ------------ |
| `shell`       | host        | —           | 4200         | 4210         |
| `catalog`     | page remote | `./Routes`  | 4201         | 4211         |
| `orders`      | page remote | `./Routes`  | 4202         | 4212         |
| `top-lots`    | widget MFE  | `./Widgets` | 4203         | 4213         |
| `roast-queue` | widget MFE  | `./Widgets` | 4204         | 4214         |

```bash
npm run build:rspack:all        # all five, production
npm run start:rspack:all    # all five dev servers
```

> **Correction to the original plan.** It assumed each page remote exposed both
> `./Routes` and `./Widgets`, and its step-2 snippet exposed
> `@rr/catalog/catalog.widgets`. No such file exists. The widget system moved out
> of `catalog`/`orders` into the two dedicated widget microfrontends, so no
> project exposes both keys. `AGENTS.md` carried the same stale claim and has been
> corrected.

### Layout

```
builds/rspack/
  tsconfig.base.json      path aliases into ../../projects/*/src
  tools/
    shared-deps.ts        share map generated from package.json
    remote-origin.ts      restores import.meta.url for the origin strip
    seam.ts               swaps the shell's federation seam at bundle time
  shell/
    rspack.config.ts
    public/{federation.manifest.json,widget-slots.json}
    src/{index.html,main.ts,bootstrap.ts,styles.scss}
    src/seam/             the only two shell files this pipeline replaces
  catalog/ orders/ top-lots/ roast-queue/
    rspack.config.ts
    src/{index.html,main.ts,bootstrap.ts,styles.scss}
```

Each application is an npm workspace (`workspaces: ["builds/rspack/*"]` in the
root `package.json`), so one `npm install` covers both pipelines and the talk
switches builds by switching terminal, not repository.

### The one thing that is shared, and why

`builds/rspack/tsconfig.base.json` maps the feature code back into the CLI
workspace — `@rr/catalog/*` → `projects/catalog/src/app/catalog/*`, and so on.
Sharing a source tree across pipelines is precisely the build-time coupling the
baseline forbids _between applications_. Here it runs in the opposite direction
and is deliberate: it makes the pipeline the only independent variable. Say it out
loud in the talk — it is the difference between a fair comparison and three
unrelated demos.

## 2. Verified version constraints

Re-verified against npm on 2026-09-06, which the plan named as the first task.

| Package                       | Latest            | Peer range                          | Verdict for Angular 22                      |
| ----------------------------- | ----------------- | ----------------------------------- | ------------------------------------------- |
| `@nx/angular-rsbuild`         | `21.2.0`          | `@angular/common >=19 <21`          | **Unusable** — what the Zephyr example uses |
| `@nx/angular-rspack`          | `23.2.0`          | `@angular/build >=20 <23`           | **Used** — the successor adapter            |
| `@nx/angular-rspack-compiler` | `23.2.0`          | `@angular/build >=20 <23`           | pulled in transitively                      |
| `@rspack/core`                | `2.2.2`           | —                                   | matches the adapter's `^2.0.0`              |
| `@rspack/cli` / `dev-server`  | `2.2.2` / `2.2.1` | `@rspack/core ^2.0.0`               | dev-server trails the CLI by a patch        |
| `@module-federation/rspack`   | `2.9.0`           | `@rspack/core ^0.7 \|\| ^1 \|\| ^2` | federation plugin                           |
| `@module-federation/enhanced` | `2.9.0`           | `webpack ^5`                        | runtime (`loadRemote`, `registerRemotes`)   |

The plan's table listed `@nx/angular-rspack@23.1.3`; it is now `23.2.0`, with the
peer range unchanged. Two corrections to that table's footnotes:

- **`stylePreprocessorOptions` is _not_ renamed.** The plan warned "the option
  name differs"; it does not. `browser`, `index`, `styles`, `assets`,
  `stylePreprocessorOptions`, `outputHashing` and `outputPath` all survive the
  move from `angular.json` verbatim. This is the adapter earning its keep.
- **The `@angular/build` monkey-patch is a no-op here.**
  `@nx/angular-rspack-compiler` ships a postinstall that rewrites files inside
  `@angular/build`, which is alarming until you read it: it returns early for
  `@angular/build >= 20.2.0`. On 22.1.7 nothing is patched.

Two version costs the plan did not anticipate:

- **`@angular/ssr` is a hard peer** of `@nx/angular-rspack` — not marked optional
  — so a browser-only build must install `@angular/ssr` and, through it,
  `@angular/platform-server`. Three packages that exist only to satisfy a
  dependency edge.
- **Installing the adapter forced an Angular patch bump** across the workspace
  (22.1.4 → 22.1.5). `@angular/localize` pins `@angular/compiler` to an exact
  version, and npm could not reconcile the old lockfile with the new tree; the
  fix was a clean re-resolve. Build 1 still builds and all 63 baseline tests pass
  on 22.1.5.

## 3. Findings

Everything below was hit while building, not predicted. Each one is a slide.

### 3.1 The pipeline mismatches that only show up in composition

Four defaults that are individually reasonable and silently incompatible. Every
one failed with an error message that named neither cause.

| Symptom                                                                      | Cause                                                                                                                                   | Fix                                                                          |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `Cannot read properties of undefined (reading 'call')` at `remoteEntry.js:3` | The adapter defaults browser builds to `optimization.runtimeChunk: 'single'`, hoisting the Rspack runtime out of the container          | `optimization: { runtimeChunk: false }`                                      |
| `Cannot use 'import.meta' outside a module`                                  | The adapter emits ESM (`output.module`, `chunkFormat: 'module'`); MF's default container is a global `var` injected as a classic script | `library: { type: 'module' }` on remotes, `remoteType: 'module'` on the host |
| `Library name base (top-lots) must be a valid identifier`                    | A `var` container needs the remote's name to be a JS identifier; `top-lots` and `roast-queue` are not                                   | dissolved by the ESM container — there is no global to name                  |
| Blank page when any one remote is down                                       | A `mf-manifest.json` entry makes `registerRemotes` resolve it eagerly, and the call rejects before `import('./bootstrap')`              | register the lazy `remoteEntry.js` entry, one remote at a time               |

The last two rows interact, and that is the sharpest part. Switching the
container to ESM fixes the script-injection error _and_ removes the naming
constraint. But dropping the manifest entry to fix the availability bug also
drops the `remoteEntry.type: "module"` field the manifest was carrying, which
reintroduces the `import.meta` error from the host side — so the lazy entry has to
say `type: 'module'` explicitly. **Two one-line fixes that undo each other if you
only apply one, and neither error message mentions the other.**

### 3.2 The dev server is a second pipeline, and it broke composition twice

Everything above was found against production builds. Running the workspace the
way the README tells you to — `npm run start:rspack:all`, five dev servers, open
the shell — failed in two further ways that **production never exhibits**. Both
were introduced by defaults nobody set, both were silent, and together they made
the shell unusable in dev while `npm run build:rspack:all` stayed perfectly green.

This is the most transferable finding in the build: `rspack serve` is not
`rspack build` with a watcher on it.

**A remote's dev client hijacks the host's page.** In dev, Rspack injects its
HMR + live-reload client into each remote's own bundle, and therefore into the
container the host loads. Mounted into the shell, that client keeps polling
**the remote's** origin for `<name>.<hash>.hot-update.json` using the compilation
hash it was built with. The dev server prunes update files for older hashes, so
after the remote's first rebuild the fetch 404s, the client decides it cannot
patch, and it calls for a full page reload — of the **shell**, which it knows
nothing about. The shell reloads, re-fetches the container, gets the same stale
hash, and the loop never ends:

```
GET http://localhost:4211/catalog.de4e2548e279956b.hot-update.json.mjs → 404
[HMR] Cannot find update. Need to do a full reload!
```

Turning off `hmr` alone is not enough — the live-reload client compares hashes
too and reports `App updated. Reloading...` on the same stale value. Both have to
go: `devServer: { hmr: false, liveReload: false }` on every remote. That pair is
also the adapter's own switch for it — `getWebSocketSettings` returns
`{ client: undefined, webSocketServer: false }` when both are false, so no client
is emitted at all. It is the same root cause behind the
`ws://localhost:4210/ng-cli-ws` failures that accompanied the loop: the client's
`webSocketURL` is `auto://0.0.0.0:0/ng-cli-ws`, and "auto" means _the origin of
the page it happens to be running in_.

The shell keeps its own client. It is the page you are looking at, it is
same-origin, and a hash mismatch there costs one self-correcting reload.

**Lazy compilation hangs a remote's second lazy level.** With the loop fixed the
shell booted, and `/catalog` rendered an empty router outlet — no error, no
fallback, nothing. `loadRemote('catalog/Routes')` resolved fine; the route's own
`loadComponent()` never settled.

`@rspack/cli` turns on `lazyCompilation: { imports: true, entries: false }` by
default for `rspack serve` unless the config sets it. Every dynamic `import()`
becomes a stub that first POSTs to `/_rspack/lazy/trigger…` to have the real
chunk compiled — resolved, again, against the origin of the page it runs in. A
remote's second lazy level executes inside the **host's** page, so the trigger
goes to the host's dev server, which knows nothing about that compilation. The
chunk is never built and the promise never resolves.

That hits every component-level boundary in this workspace: a page remote's
`loadComponent`, and a widget descriptor's `load()`. `lazyCompilation: false` in
all five configs.

Note the failure _mode_, because it is what makes this expensive: it hangs rather
than throwing. `loadRemoteRoutes` has a `try/catch` that renders
`RemoteUnavailableComponent`, and it never ran — a promise that never settles is
not a rejection. The shell's careful error handling is invisible to it.

**Neither build 1 nor build 3 has either problem.** The baseline runs five
`ng serve`s and composes fine. Vite has no lazy-compilation stubs, and its HMR
client is a per-origin websocket with no hash comparison to go stale. Verified by
running all three.

### 3.3 A dead remote took down the whole host

Worth separating out, because it is a regression against the baseline rather than
a configuration wrinkle. Stopping the `catalog` dev server left the shell as a
blank page — no header, no router, and the three healthy remotes gone too. That is
exactly the failure runtime composition exists to prevent.

Two causes, both in `registerRemotes`: a manifest-style entry is resolved during
registration rather than on first use, and one call registering four remotes
rejects wholesale on the first that does not answer. After the fix
(`builds/rspack/shell/src/main.ts`) the shell boots, the header renders, and
`/catalog` degrades to `RemoteUnavailableComponent` — build 1's behaviour.

### 3.4 `import.meta.url` did not survive, and leaked the build machine

The plan predicted this risk. The reality was worse than "it does not work":
Rspack's parser substituted `import.meta.url` at build time with the **absolute
`file://` path of the source file on the build machine**, so the shipped bundle
contained `/Users/<name>/…/remote-origin.component.ts` and the strip would have
displayed a developer's home directory instead of the serving origin.

`tools/remote-origin.ts` substitutes `__webpack_require__.p` instead, which
`publicPath: 'auto'` resolves at runtime from the script that loaded the chunk.
Verified: the strip reads `localhost:4211` under `ng serve`-equivalent and still
`localhost:4211` when the shell at `:4210` mounted it.

The baseline needs no equivalent, because native ES modules keep their own
identity all the way to the browser.

### 3.5 The share map is hand-maintained — so it was generated

Native Federation's `shareAll(...)` derives the share map from `package.json` and
cannot drift. Module Federation has no equivalent, and every published example
writes the map out by hand with a `requiredVersion` string per package, repeated
on both sides of every boundary.

`tools/shared-deps.ts` generates it instead, which is the honest comparison to put
on the slide: `shareAll` versus **65 lines**, most of them explaining two
behaviours that are free in the baseline:

- **Secondary entry points.** Sharing `@angular/common` does not share
  `@angular/common/http`. A remote injecting `HttpClient` would get its own copy.
  MF's trailing-slash prefix key is the counterpart of the baseline's
  `includeSecondaries: { keepAll: true }`.
- **`skip`.** The same four `rxjs` entry points, for the same reason.

The cost of the manual map is not that it is hard to write once. It is that
nothing tells you when it is wrong.

### 3.6 The shell was the only application that needed changing

Criterion 3 held, and more cleanly than expected. The two page remotes and both
widget microfrontends compile **completely unmodified** from `projects/*` — their
exposed entry points touch no federation API at all, so a `paths` alias is the
whole port. `top-lots.widgets.ts` and `roast-queue.widgets.ts` in particular are
plain `@angular/core` — `Type`, `Provider | EnvironmentProviders` and a bare
dynamic `import()` — which is exactly why they cross to a different federation
runtime without an edit.

The shell is the only application that _calls_ a federation runtime, and the two
runtimes are different APIs. Two modules are replaced:

| Module                       | Why                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `remote.util.ts`             | `federation().loadRemoteModule(remote, './Routes')` → `loadRemote('catalog/Routes')` |
| `remote-registry.service.ts` | `mf-manifest.json` spells Native Federation's `exposes[].key` as `exposes[].path`    |

They are substituted **below the import graph** (`tools/seam.ts`) rather than
copied. Copying would have been much worse: `remote.util.ts` is reached from
`app.routes.ts` by a relative import, so a copy drags in copies of
`app.routes.ts`, `app.config.ts`, `bootstrap.ts` and `remote-slot.component.ts` —
six files duplicated to change two, weakening the central claim with each one.
Everything else under `projects/shell/src` compiles byte for byte from build 1.

**The seam substitution failed silently on the first attempt** and shipped build
1's Native Federation calls inside a green build. `NormalModuleReplacementPlugin`
is a native builtin whose function form must _return_ new resolve data rather
than mutate what it is handed. The plugin now matches on the `(context, request)`
pair itself, and asserts that no unreplaced original reaches
`compilation.modules` — a build error naming the file, instead of a runtime
failure on first navigation.

### 3.7 Answers to the plan's two open questions

- **`import '@angular/compiler'` is not needed.** Both Zephyr Angular examples
  import the JIT compiler in `bootstrap.ts`. It is a leftover: everything here is
  AOT-compiled by `@nx/angular-rspack-compiler`, and all five applications build,
  serve and compose without it. Do not ship a compiler.
- **Dynamic remotes were implemented, not skipped.** The host's plugin declares
  `remotes: {}`; `main.ts` fetches the same `federation.manifest.json` asset build
  1 uses, in the same `{ name: url }` schema, and calls `registerRemotes`. Adding a
  widget microfrontend stays two JSON edits and a deploy with no shell rebuild —
  parity with the baseline, bought with ~30 lines and the fix in §3.2.

### 3.8 Still out of scope

- **Bridges**, and that is a finding rather than a gap. MF Bridge ships for React
  and Vue 3 only; there is no Angular bridge, and its provider contract is
  DOM-based (`render({ dom })`), which would mean a second `ApplicationRef` per
  remote and no injector inheritance from the host. It exists to cross _framework_
  boundaries. `shop.lululemon.com` runs 12 remotes with zero bridges, because
  everything there is React and the React packages are simply shared singletons —
  the same posture `shareAll` gives the baseline.
- **Flat keys vs one manifest key**, the comparison task in the plan's step 2.
  Not implemented. The baseline's single `./Widgets` descriptor list was ported as
  is; production MF tends the other way (lululemon's `layout` remote exposes
  `./Root`, `./atoms/layout`, `./atoms/config`, `./utils/getNavData` as separate
  flat keys, with the host hardcoding them). Implementing one widget both ways and
  measuring round trips per added widget is still worth doing.
- **Zephyr Cloud** (step 5). Deployment-and-resolution layer rather than bundler
  layer.
- **Tests.** Build 2 has no test target. Build 1's 63 specs still pass and cover
  the feature code both pipelines share; what is untested is the seam. See §5.

## 4. Parity checklist

Verified against the production builds of all five applications, served
cross-origin on `:4210`–`:4214`, **and** re-verified against
`npm run start:rspack:all` after the dev-server fixes in §3.2.

- [x] **Both page remotes render inside the shell with correct styling.**
      `/catalog` renders 96 lots, `/orders` renders 56 orders. Component styles
      cross the boundary; neither remote's global stylesheet is needed.
- [x] **Exactly one `@angular/core` on the page.** Verified, not assumed:
      `shareScopeMap.default['@angular/core']` holds a single version key,
      `22.1.5`, `loaded: true`, `from: 'shell'`, and the document has one
      `script[src]`. All four remotes resolve against it.
- [x] **Route-scoped `provideHttpClient` still isolates the two mock
      interceptors.** Catalog renders bean data and orders renders order data
      with no leakage, and the shell provides no HTTP stack of its own.
- [x] **Killing a remote produces the fallback, not a dead router.** With `:4211`
      stopped, `/catalog` renders `RemoteUnavailableComponent`, the header and
      router keep working, and the other three remotes are unaffected. This is
      what §3.2 fixed.
- [x] **Each remote still runs standalone on its own port.** Including both
      widget galleries, which mount their own descriptors — and the widget still
      starts at `<h3>` under the gallery's `<h1>`.
- [x] **Production build succeeds and emits comparable artefacts.** Five
      `mf-manifest.json` files with the expected `exposes` keys and share counts
      (9 for each page remote, 8 for each widget MFE — the widgets share no
      `@angular/router`, as intended).
- [x] **Both widget microfrontends mount into shell slots**, each rendering its
      own data behind its own `@defer (on viewport)` boundary, with origin strips
      reading `localhost:4213` and `localhost:4214`.
- [x] **`npm run start:rspack:all` composes.** The shell boots and stays booted,
      both routes render from their remotes, both widget slots mount, all four
      remotes probe reachable, and a clean load makes zero failed requests. This
      is the item §3.2 exists for — it failed for a long time while every
      production check above passed.

## 5. Known gaps

- **No test target for build 2.** `tools/seam.ts` asserts at build time that no
  unreplaced original reaches the bundle, which covers the failure that actually
  happened. The seam modules themselves have no specs, and build 1's
  `remote.util.spec.ts` does not exercise them.
- **A remote that comes back up needs a page reload.** Registration happens once,
  before Angular exists. The topology panel's "Re-probe" re-reads manifests but
  does not re-register. The baseline has the same property, so this is parity, not
  a regression — but neither build recovers a remote live.
- **`@angular/ssr` and `@angular/platform-server` are installed for nothing.**
  Hard peers of an adapter used only for browser builds.
- **No hot reload for remotes.** §3.2 turns the dev client off in all four, so
  editing a remote while the shell is open needs a manual refresh. A remote
  served on its own port has no live reload either. Making it conditional (live
  reload when a remote is started alone, off under `start:rspack:all`) is a small
  env-var change that has not been made — the unconditional version is one
  behaviour to explain instead of two.

## 6. What the talk gets from this build

Measured on this machine, five applications, production mode, cold cache. The
**three-way** version of this table, with build 3 alongside, is in
[`PLAN-VITE.md` §8](PLAN-VITE.md) - prefer that one for the slide.

| Dimension                          | Build 1 (Native Federation) | Build 2 (Rspack + MF)                         |
| ---------------------------------- | --------------------------- | --------------------------------------------- |
| Cold production build, 5 apps      | **7.5 s**                   | **10.5 s**                                    |
| Incremental rebuild on file save   | **~90 ms**                  | **~80 ms** (plus no `rebuildDelay`)           |
| Initial transferred bytes, shell   | **23.8 kB** gzip            | **33.1 kB** gzip (MF runtime is in `main.js`) |
| Lines of build/federation config   | **156** (code only)         | **334** (code only)                           |
| Shared-dep map: derived or manual  | derived (`shareAll`)        | manual — generated here, in 65 lines          |
| Remote URLs: data or compiled      | data (manifest asset)       | data, via `registerRemotes` (see §3.2)        |
| `ng update` migration path         | yes                         | no — the adapter's own cadence                |
| `ng test`, budgets, i18n           | first-party                 | re-solve per feature                          |
| Component-level exposure           | one `./Widgets` descriptor  | identical — ported unmodified                 |
| Adapter needed for Angular→Angular | none                        | none (Bridge is for cross-framework)          |
| Angular version ceiling            | tracks Angular              | set by the adapter (`<23`)                    |
| Unload / layered singletons        | not available               | available                                     |

Read the first three rows together, because the headline is not the one the
Rspack marketing suggests: **on this workspace the Angular CLI is faster cold,
the two are a wash incrementally, and build 2 ships more bytes.** Rspack's
rebuild advantage is real against webpack; Angular's builder is already esbuild,
so there is nothing left to win. What build 2 actually buys is the Module
Federation ecosystem — runtime plugins, unloading, layered share scopes — and what
it costs is in rows four through eleven.

### Caveats on the numbers

- Cold-build times are wall clock for `npm run build` / `npm run build:rspack:all`,
  which run the five applications sequentially. Both pipelines parallelise
  internally; the CPU figures were 211% and 268% respectively.
- The transferred-byte figures are gzip of the JS and CSS referenced by each
  shell's `index.html`. Build 1's number excludes the federation runtime and
  `remoteEntry.json` fetches that follow, so the gap in bytes-to-first-render is
  narrower than 23.8 vs 33.1 suggests. Measure it live if the slide needs it.
- Config lines exclude blank and comment-only lines, and count each pipeline's
  federation and build configuration only — five configs, the shared tooling and
  the host entry point on each side.
