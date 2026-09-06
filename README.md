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
first-party-toolchain path. Two further builds of the same product — one on
Rsbuild, one on Vite — are planned in [`docs/PLAN-RSBUILD.md`](docs/PLAN-RSBUILD.md)
and [`docs/PLAN-VITE.md`](docs/PLAN-VITE.md), so the talk can compare all three
against a fixed application.

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
```
