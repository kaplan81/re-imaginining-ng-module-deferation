# Re-imagining Angular Module Federation

Demo workspace for the talk **"Module Federation in Angular: beyond the default toolchain"**.

Three independently built Angular 22 applications are composed in the browser by
[Angular Architects Native Federation](https://github.com/angular-architects/module-federation-plugin/blob/main/libs/native-federation/README.md):
a **shell** that owns layout, navigation and the federation manifest, plus two
**remotes** that each own a feature, its data access and its own mocked backend.

The product is _Roast Republic_, a specialty-coffee operations console:

| Project   | Role   | Port | Owns                                                          |
| --------- | ------ | ---- | ------------------------------------------------------------- |
| `shell`   | host   | 4200 | Chrome, routing, the manifest, remote health, fallback UI     |
| `catalog` | remote | 4201 | Green-coffee lots: search, roast/origin filters, sort, paging |
| `orders`  | remote | 4202 | Roast orders: KPI tiles, status filters, sort, paging         |

This repository is the **baseline** of the talk. It implements the conservative,
first-party-toolchain path. Two further builds of the same product — one on
Rspack, one on Vite — are planned in [`docs/PLAN-RSPACK.md`](docs/PLAN-RSPACK.md)
and [`docs/PLAN-VITE.md`](docs/PLAN-VITE.md), so the talk can compare all three
against a fixed application.

## Quick start

Start the remotes first: the shell fetches their `remoteEntry.json` during
bootstrap, before Angular is even loaded.

```bash
npm install
```

Three terminals:

```bash
npm run start:catalog
```

```bash
npm run start:orders
```

```bash
npm run start:shell
```

Or all three in one (backgrounds the remotes; `Ctrl+C` may leave strays):

```bash
npm run start:all
```

Then open:

- <http://localhost:4200/> — the composed console
- <http://localhost:4201/> — the catalog remote, standalone
- <http://localhost:4202/> — the orders remote, standalone

## Other commands

```bash
npm run build
```

Builds all three applications (remotes first, so the shell's manifest resolves).
`npm run build:shell` / `build:catalog` / `build:orders` build one.

```bash
npm test
```

42 specs across the three projects (Vitest through `@angular/build:unit-test`).
`npm run test:shell` / `test:catalog` / `test:orders` run one.

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
   and its own service. The shell provides no `HttpClient` at all.

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
4. **Break a remote.** `Ctrl+C` the catalog dev server, then click _Bean catalog_.
   The shell stays alive, navigation keeps working, and the fallback explains what
   happened. Go back to `/home` and hit **Re-probe**: catalog flips to
   _Unreachable_ while orders stays green.
5. **Deploy one side only.** `npm run build:catalog` alone. The shell needs no
   rebuild, because it holds no compiled reference to the catalog.

## Relationship to the other two repositories

- **`adg-coding-challenge`** — the Angular 21 original: one shell, one
  `prescription` remote, and the written rationale for choosing Native Federation
  over Webpack/Rspack MF, Vite federation and raw ESM. This repo keeps that
  architecture and moves it to Angular 22, two remotes and a non-medical domain.
  Notable differences introduced by Native Federation 22 are listed in
  [`docs/ARCHITECTURE.md#what-changed-since-native-federation-21`](docs/ARCHITECTURE.md#what-changed-since-native-federation-21).
- **`ZephyrCloudIO/zephyr-examples`** — reference examples for the Rspack and Vite
  paths (`module-federation/angular-rsbuild`, `module-federation/angular-vite`).
  They are the starting point for the two plans in `docs/`, not a template to
  copy: their Angular and adapter versions are already behind, which is itself
  part of the talk's argument.

## Layout

```
angular.json                     3 projects; each has esbuild + native-federation targets
styles/                          Shared SCSS design tokens - the ONE build-time coupling
projects/
  shell/
    federation.config.mjs        host: shares, no exposes
    tsconfig.federation.json     entry points the federation build compiles
    public/
      federation.manifest.json   where the remotes live - editable without a rebuild
    src/
      federation.ts              holds the runtime handle from initFederation
      main.ts                    initFederation -> bootstrap
      app/app/                   chrome, routing, remote registry, fallback
      app/home/                  overview page + live topology panel
  catalog/
    federation.config.mjs        remote: exposes ./Routes
    src/app/catalog/             feature: components, container, mock backend, service
  orders/
    federation.config.mjs        remote: exposes ./Routes
    src/app/orders/              feature: components, container, mock backend, service
```
