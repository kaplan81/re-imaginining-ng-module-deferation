# Re-imagining Angular Module Federation

Demo workspace for the talk **"Module Federation in Angular: beyond the default toolchain"**.

Five independently built Angular 22 applications are composed in the browser by
[Angular Architects Native Federation](https://github.com/angular-architects/module-federation-plugin/blob/main/libs/native-federation/README.md):
a **shell** that owns layout, navigation and the federation manifest, two **page
remotes** that each own a whole route subtree, and two **widget microfrontends**
that own no page at all — they publish a single mountable component apiece, which
the shell drops into a slot on a page it owns.

The product is _Roast Republic_, a specialty-coffee operations console:

| Project       | Role       | Port | Owns                                                             |
| ------------- | ---------- | ---- | ---------------------------------------------------------------- |
| `shell`       | host       | 4200 | Chrome, routing, the manifest, remote health, fallback UI        |
| `catalog`     | page       | 4201 | Green-coffee lots: search, roast/origin filters, sort, paging    |
| `orders`      | page       | 4202 | Roast orders: KPI tiles, status filters, sort, paging            |
| `top-lots`    | widget MFE | 4203 | One component: the highest-scoring lots. No pages, no router.    |
| `roast-queue` | widget MFE | 4204 | One component: what the roastery owes next. No pages, no router. |

This repository is the **baseline** of the talk. It implements the conservative,
first-party-toolchain path.

Two further builds of the same product are **implemented** alongside it, and all
three run at once:

| Build | Pipeline                           | Ports     | Code                              | Write-up                                                  |
| ----- | ---------------------------------- | --------- | --------------------------------- | --------------------------------------------------------- |
| 1     | Angular CLI + Native Federation    | 4200–4204 | `projects/`                       | this file, [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| 2     | Rspack + classic Module Federation | 4210–4214 | [`builds/rspack/`](builds/rspack) | [`docs/PLAN-RSBUILD.md`](docs/PLAN-RSBUILD.md)            |
| 3     | Vite + classic Module Federation   | 5173–5177 | [`builds/vite/`](builds/vite)     | [`docs/PLAN-VITE.md`](docs/PLAN-VITE.md)                  |

The three share one source tree on purpose, so the pipeline is the only variable
between them: builds 2 and 3 contain no feature code at all, only entry points
and build configuration. The three-way comparison table is in
[`docs/PLAN-VITE.md` §8](docs/PLAN-VITE.md).

## Quick start

Start the remotes first: the shell fetches their `remoteEntry.json` during
bootstrap, before Angular is even loaded.

```bash
npm install
```

One terminal per application, or `start:all` below:

```bash
npm run start:catalog
```

```bash
npm run start:orders
```

```bash
npm run start:top-lots
```

```bash
npm run start:roast-queue
```

```bash
npm run start:shell
```

Or all five in one (backgrounds the others; `Ctrl+C` may leave strays):

```bash
npm run start:all
```

Then open:

- <http://localhost:4200/> — the composed console
- <http://localhost:4201/> — the `catalog` page remote, standalone
- <http://localhost:4202/> — the `orders` page remote, standalone
- <http://localhost:4203/> — the `top-lots` widget microfrontend, standalone
- <http://localhost:4204/> — the `roast-queue` widget microfrontend, standalone

The last two publish no pages at all. Opening them directly renders the widgets
they expose under `./Widgets`, which is how they are developed without the shell.

> Adding or renaming an exposed key needs the remote's dev server **restarted**.
> A running `ng serve` keeps serving a `remoteEntry.json` without the new key
> while serving its chunk, so the shell reports the remote as unreachable for
> that key with nothing in the log to explain it.

## Other commands

```bash
npm run build
```

Builds all five applications (the shell last, so its manifest resolves).
`npm run build:<project>` builds one — and a widget microfrontend can be built and
deployed entirely on its own, because nothing holds a compiled reference to it.

```bash
npm test
```

63 specs across the five projects (Vitest through `@angular/build:unit-test`).
`npm run test:<project>` runs one. Every project needs at least one spec: the
builder fails a target outright when a project has none.

```bash
npm run format
```

### The other two builds

```bash
npm run start:rspack:all
npm run build:rspack:all
```

Build 2: Rspack + Module Federation, ports 4210–4214. See
[`builds/rspack/README.md`](builds/rspack/README.md).

```bash
npm run start:vite:all
npm run build:vite:all
npm run preview:vite:all
```

Build 3: Vite + Module Federation, ports 5173–5177. `vite preview` is the real
checkpoint there, since Vite's dev and build paths differ. See
[`builds/vite/README.md`](builds/vite/README.md).

Every script for builds 2 and 3 is `<verb>:<pipeline>:<target>`, where the target
is always named — `all` or one of `shell`, `catalog`, `orders`, `top-lots`,
`roast-queue`. There is no bare `build:rspack` or `start:vite`: in a workspace
with five applications per pipeline, a script that does not say what it runs is a
script you have to look up. (Build 1 keeps plain `npm start`, `npm run build` and
`npm test`, because those are npm's own conventions rather than this repo's, and
`start:everything` sits outside the pattern on purpose — it is the one script
that crosses all three pipelines.)

Both builds reuse the feature code in `projects/*` unmodified.

### Running all three at once

```bash
npm run start:everything
```

Fifteen dev servers — all five applications of all three pipelines — and three
shells composing side by side at <http://localhost:4200>,
<http://localhost:4210> and <http://localhost:5173>. That is the three-way demo,
and it works because the ports never overlap (4200–4204, 4210–4214, 5173–5177)
and each pipeline has its own output root (`dist/`, `builds/rspack/*/dist`,
`builds/vite/*/dist`).

Output is prefixed by pipeline and application — `[rspack] [ord]`, `[vite] [cat]`
— and one `Ctrl-C` stops all fifteen. Give it about 80 seconds; build 1's five
`ng serve`s are the slow part.

### Every port

The full map, and the reason all three pipelines can run at once. Build 3's
`vite preview` reuses build 3's dev ports, so `start:vite:all` and
`preview:vite:all` are mutually exclusive.

| Application   | Role        | Exposes     | 1 — Angular CLI                   | 2 — Rspack                        | 3 — Vite                          |
| ------------- | ----------- | ----------- | --------------------------------- | --------------------------------- | --------------------------------- |
| `shell`       | host        | —           | **[4200](http://localhost:4200)** | **[4210](http://localhost:4210)** | **[5173](http://localhost:5173)** |
| `catalog`     | page remote | `./Routes`  | [4201](http://localhost:4201)     | [4211](http://localhost:4211)     | [5174](http://localhost:5174)     |
| `orders`      | page remote | `./Routes`  | [4202](http://localhost:4202)     | [4212](http://localhost:4212)     | [5175](http://localhost:5175)     |
| `top-lots`    | widget MFE  | `./Widgets` | [4203](http://localhost:4203)     | [4213](http://localhost:4213)     | [5176](http://localhost:5176)     |
| `roast-queue` | widget MFE  | `./Widgets` | [4204](http://localhost:4204)     | [4214](http://localhost:4214)     | [5177](http://localhost:5177)     |

The three shells in bold are the pages to open. Where each port is declared, if
you ever need to change one:

| Pipeline | Declared in                                                                                 |
| -------- | ------------------------------------------------------------------------------------------- |
| 1        | `angular.json` → `<project>.architect.serve-original.options.port`                          |
| 2        | `builds/rspack/<app>/rspack.config.ts` → `devServer.port`                                   |
| 3        | `builds/vite/<app>/vite.config.ts` → `server.port`, `preview.port`, and the absolute `base` |

Build 3 needs the port in three places because a remote's chunks must be fetched
from the remote's own origin, not from whoever mounted it — see
[`builds/vite/README.md`](builds/vite/README.md).

What does collide is a dev server and a **production build of the same
pipeline**, because the three treat `dist/` differently:

| Pipeline           | What its dev server does to that pipeline's `dist/`                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — `ng serve`     | **Writes into it.** Native Federation serves real ES modules through an import map, so `dist/<project>/browser` fills with dev-mode artifacts (`…-dev.js`, `remoteEntry.json`). |
| 2 — `rspack serve` | **Empties it** on startup and serves from memory.                                                                                                                               |
| 3 — `vite`         | **Ignores it.** Vite serves from memory; anything in `dist/` is a leftover.                                                                                                     |

So after running `npm run start:all` or `npm run start:rspack:all`, that
pipeline's `dist/` is either dev-mode output or gone. Re-run the build before
measuring bundle sizes or serving the built output — a stale or emptied `dist/`
is the one way to get numbers that look real and are not.

Build 3 has a second, simpler constraint: `start:vite:all` and `preview:vite:all`
both bind 5173–5177, so they are mutually exclusive.

## The 60-second version of how it works

1. `projects/shell/src/main.ts` calls `initFederation('federation.manifest.json')`
   **before** importing anything Angular.
2. The runtime reads the manifest, fetches each remote's `remoteEntry.json`,
   negotiates shared dependency versions and installs an import map.
3. Only then does `import('./bootstrap')` run, so shell and remotes resolve the
   same `@angular/core` instance.
4. Navigating to `/catalog` calls `loadRemoteModule('catalog', './Routes')`. The
   remote's route table is fetched over the network and grafted onto the shell
   router.
5. That route table brings its own `provideHttpClient`, its own mock interceptor
   and its own service. The shell installs no HTTP interceptors at all.
6. Two further applications — `top-lots` and `roast-queue` — expose only
   `./Widgets`: a list of individually mountable components, and no route table at
   all. `/home` mounts them in slots on a page the shell owns, so one document
   holds components from five independent builds.
7. Which widget microfrontends exist, and where they go, is read from
   `widget-slots.json` at runtime. Adding one never rebuilds the shell.

Full walkthrough, including the boundaries and the trade-offs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Demo script for the talk

1. **Show the topology.** `/home` reads the same manifest the runtime used and
   probes each `remoteEntry.json` live. Both remotes read _Reachable_, with their
   exposed keys and shared-package count.
2. **Show composition.** Navigate to _Bean catalog_. In DevTools → Network,
   `Routes.js` and the feature chunk come from `localhost:4201`, while
   `@angular/core` is served once from `localhost:4200`. The amber "Rendered by
   the catalog remote" strip reads its own origin from `import.meta.url`.
3. **Show a second team's remote.** Navigate to _Roast orders_: teal accent, its
   own KPI contract, its own interceptor — on the same page, in the same Angular
   instance, from a different build.
4. **Drop the granularity from page to component.** Back on `/home`, scroll to
   _Components from five builds, one document_. Two widgets appear, each from an
   application that publishes no pages at all, inside a page the shell owns. In
   DevTools → Network, note the ordering: `Widgets.js` from `:4203` and `:4204`
   only when the slots enter the viewport, and _then_ each widget's own component
   chunk, fetched by the microfrontend's inner `import()`. Two nested lazy levels —
   and `Routes.js` never loads at all, because the page remotes were never
   navigated to. Both origin strips read `localhost:4203` / `localhost:4204` while
   the document is `:4200`.

   The division of labour is worth naming: `@defer (on viewport)` can only defer
   dependencies the compiler sees statically, so it defers the shell's own slot
   component; federation does the cross-origin fetch inside it.

5. **Add a microfrontend without touching the shell.** Edit
   `projects/shell/public/widget-slots.json` — add a slot, or point one at a widget
   id that does not exist — and reload. The lineup changes with no rebuild, and a
   bad id reports _"reachable but publishes no widget called…"_ rather than
   pretending the application is down. Unreachable and not-found are different
   failures with different fixes, so the slot distinguishes them.
6. **Break a remote.** `Ctrl+C` the `top-lots` dev server and reload `/home`. That
   slot degrades on its own, the `roast-queue` widget beside it keeps rendering, and
   the page stays interactive. Hit **Re-probe** on the topology panel: `top-lots`
   flips to _Unreachable_ while everything else stays green.
7. **Deploy one side only.** `npm run build:top-lots` alone. Nothing else rebuilds —
   not the shell, not the page remotes — because nobody holds a compiled reference
   to it.

## Relationship to the other two repositories

- **`adg-coding-challenge`** — the Angular 21 original: one shell, one
  `prescription` remote, and the written rationale for choosing Native Federation
  over Webpack/Rspack MF, Vite federation and raw ESM. This repo keeps that
  architecture and moves it to Angular 22, four remotes across two kinds, and a
  non-medical domain.
  Notable differences introduced by Native Federation 22 are listed in
  [`docs/ARCHITECTURE.md#what-changed-since-native-federation-21`](docs/ARCHITECTURE.md#what-changed-since-native-federation-21).
- **`ZephyrCloudIO/zephyr-examples`** — reference examples for the Rsbuild and Vite
  paths
  ([`module-federation/angular-rsbuild`](https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/module-federation/angular-rsbuild),
  [`module-federation/angular-vite`](https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/module-federation/angular-vite)).
  They are the starting point for the two plans in `docs/`, not a template to
  copy: their Angular and adapter versions are already behind, which is itself
  part of the talk's argument.

## Layout

```
angular.json                     5 projects; each has esbuild + native-federation targets
projects/
  shell/                         the host, :4200
    federation.config.mjs        shares, no exposes
    tsconfig.federation.json     entry points the federation build compiles
    public/
      federation.manifest.json   where every application lives - edit, no rebuild
      widget-slots.json          which widget MFEs exist and where they mount
    src/
      federation.ts              holds the runtime handle from initFederation
      main.ts                    initFederation -> bootstrap
      app/app/                   chrome, routing, registry, fallback, remote-slot
      app/home/                  overview page, topology panel, widget slots
  catalog/                       page remote, :4201 - exposes ./Routes
    src/app/catalog/             feature: components, container, mock backend, service
  orders/                        page remote, :4202 - exposes ./Routes
    src/app/orders/              feature: components, container, mock backend, service
  top-lots/                      widget MFE, :4203 - exposes ./Widgets, no router
    src/app/top-lots/            its own widget, service, interceptor, seed, models
  roast-queue/                   widget MFE, :4204 - exposes ./Widgets, no router
    src/app/roast-queue/         its own widget, service, interceptor, seed, models

Each project also owns projects/<app>/styles/ - five byte-identical copies of
_tokens.scss and _base.scss, because no project reads a sibling's stylesheet.

builds/rspack/                   build 2: same feature code, Rspack + Module Federation
  tsconfig.base.json             paths aliases mapping @rr/* onto projects/*
  tools/                         share map, import.meta.url fix, the shell seam swap
  shell/                         the host, :4210 - registers remotes at runtime
    src/seam/                    the only two shell modules this pipeline replaces
  catalog/ orders/               page remotes, :4211 / :4212
  top-lots/ roast-queue/         widget MFEs, :4213 / :4214
builds/vite/                     build 3: same feature code, Vite + Module Federation
  tools/                         share map, alias derivation, the shell seam swap
  shell/                         the host, :5173
  catalog/ orders/               page remotes, :5174 / :5175
  top-lots/ roast-queue/         widget MFEs, :5176 / :5177

No project under builds/ contains feature code - only entry points and build
configuration. That is what makes the pipeline the only variable.
```
