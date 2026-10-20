# Measurements — NG Poland 2026

Captured 2026-10-20 on Apple M4 Pro, 14 cores, 48 GB, node v24.20.0, commit `8df5317`.
Angular 22.2.3 · Native Federation 22.2.3 · Rspack 2.2.9 · Vite 8.3.4 · MF 2.9.2 / 1.23.5.

Reproduce with:

```bash
node tools/measure-builds.mjs --runs 2      # cold builds + JS on disk
node tools/serve-dist.mjs <1|2|3>           # then measure the home page in a browser
node tools/count-config.mjs                 # configuration surface
```

## Cold production build, five applications

Each pipeline's own caches cleared before every run — see `tools/measure-builds.mjs`.
Fastest of two runs; both runs reproduced.

| Pipeline              | Cold      | Spread | JS on disk, 5 apps | `top-lots` |
| --------------------- | --------- | ------ | ------------------ | ---------- |
| 1 · CLI + Native Fed. | 7.6 s     | 0.1 s  | 3682 kB            | **644 kB** |
| 2 · Rspack + MF       | 8.2 s     | 1.2 s  | 4092 kB            | 762 kB     |
| 3 · Vite + MF         | **7.1 s** | 0.0 s  | 3894 kB            | 706 kB     |

Zürich quoted 8.4 / 10.3 / 8.1 s. The **ordering is unchanged** — Vite fastest,
Rspack slowest — on faster hardware and newer versions. `top-lots` on disk has
inverted: build 1 went 766 → 644 kB and is now the smallest, where it used to be
the largest. That change is confounded between the Angular 22.2 bump and the
`denseExternals` / skip-list configuration change, which landed in the same commit;
isolating it needs a separate A/B.

## Home page, production bundles, cold cache

Served by `tools/serve-dist.mjs` — one static server implementation for all three,
no compression, no caching, `Timing-Allow-Origin: *`. Uncompressed bytes.

| Pipeline              | Transferred  | Requests | Same-origin only |
| --------------------- | ------------ | -------- | ---------------- |
| 1 · CLI + Native Fed. | **779.5 kB** | 37       | ~760 kB          |
| 2 · Rspack + MF       | 1261.9 kB    | 27       | 267.4 kB         |
| 3 · Vite + MF         | 826.7 kB     | 28       | ~810 kB          |

### The Zürich 268 kB was a measurement artifact

The deck reported **268 kB** for build 2 and used it as the headline "Rspack ships
least" figure. Build 2's **same-origin** total measures **267.4 kB** — a match to
within 1 kB. The old number counted only what the shell's own port served and
missed ~994 kB coming from the four remote origins.

Cross-origin resources report `decodedBodySize: 0` in the Performance API unless
the server sends `Timing-Allow-Origin`. Any measurement taken without that header
undercounts precisely the pipeline that fetches most from remotes — which is the
one the slide was praising. **Do not reuse the old figure.**

### Where build 2's bytes go

| Origin           | Requests | kB        |
| ---------------- | -------- | --------- |
| 4210 shell       | 10       | 267.4     |
| 4211 catalog     | 2        | 122.0     |
| 4212 orders      | 2        | 122.0     |
| 4213 top-lots    | 10       | **628.4** |
| 4214 roast-queue | 2        | 121.1     |

Every remote ships a **~117 kB `remoteEntry.js`**, fetched for all four at boot.
That is the "executable container" made concrete: build 1's `remoteEntry.json` is
6 kB of data; build 2's equivalent is 117 kB of code, four times over.

`top-lots` additionally serves 511 kB of chunks, fetched at **19–41 ms with
`initiatorType: "script"`** — eagerly, as the ESM container's static import graph
resolves — for a widget that **is not rendered on the home page**
(`widgetHostEls: 0`).

### Angular is shared correctly — verified, not assumed

The MF share scope on build 2 holds exactly one entry:

```
@angular/core → { version: "22.2.3", from: "shell", loaded: true, useIn: ["shell", "top-lots"] }
```

One instance, provided by the shell, used by the shell and the widget. The 628 kB
from the widget origin is **not** a second Angular. Build 1 independently confirms
the same property: one `_angular_core.*.js` request, and all 13 shared entry points
hash-identical across the five applications.

## OPEN QUESTION — resolve before these three numbers go on a slide

Build 2 fetches widget **code** on the home page (10 requests from `top-lots`);
builds 1 and 3 fetch only metadata there (2 and 1 requests respectively, no chunks).
Until it is understood why — eager ESM container graph, a widget-slot difference, or
something in the shell's registration — the three transferred-byte figures are not
strictly like-for-like, and the comparison should be presented per-origin rather
than as three single totals.

## Configuration surface

See `tools/count-config.txt`. Summary: 991 / 1175 / 997 raw lines, 304 / 427 / 355
for federation config alone, 17 / 20 / 20 files, **2 / 6 / 4 build-tooling packages**.

## Version ceiling

| Pipeline | Angular adapter                                | Declared peer range       | Reality                                                                    |
| -------- | ---------------------------------------------- | ------------------------- | -------------------------------------------------------------------------- |
| 1        | `@angular-architects/native-federation@22.2.3` | `@angular/build ~22.2.0`  | Tracks Angular to the **minor** — upgrade in lockstep                      |
| 2        | `@nx/angular-rspack`                           | `@angular/build >=20 <23` | **Stable (23.3.0) does not build Angular 22.2.** Needs `24.0.0-beta.4`     |
| 3        | `@analogjs/vite-plugin-angular@2.9.0`          | `@angular/build ^18–^22`  | Published 2026-10-19; `@module-federation/vite` adds no Angular constraint |
