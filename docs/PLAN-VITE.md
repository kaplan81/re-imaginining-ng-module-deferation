# Plan — build 3: Vite + Module Federation

Third of the three builds in the talk. Same product, same application code, a
pipeline built on **Vite** with `@analogjs/vite-plugin-angular` and
`@module-federation/vite`.

Status: **planned, not implemented.**

---

## 1. Goal

Rebuild _Roast Republic_ — shell + `catalog` + `orders` — so that:

- Angular is compiled by **Vite** through the AnalogJS plugin.
- Composition uses **`@module-federation/vite`**, i.e. the classic MF contract
  implemented on top of Rollup/Rolldown output.
- The **feature code is byte-identical** to the baseline, for the same reason as in
  [`PLAN-RSPACK.md`](PLAN-RSPACK.md#the-one-thing-that-is-shared-and-why).

## 2. Why this needs a third-party plugin at all

Worth a slide of its own, because it is the cleanest illustration of the talk's
thesis.

Angular's `application` builder **already uses Vite** — for the dev server. But
that Vite instance is _encapsulated_ by the Angular CLI: there is no
`vite.config.ts` to put plugins into, so `@module-federation/vite` cannot reach
it. Angular's own [custom build pipeline
docs](https://angular.dev/ecosystem/custom-build-pipeline) name tightly-coupled
Module Federation as a niche reason to leave the default pipeline, and point at the
AnalogJS Vite plugin as the supported community route.

So: "Angular uses Vite" and "you can use Vite with Angular" are different claims.
This build is the second one.

## 3. Verified version constraints

Checked against npm at the time of writing. Unlike the Rspack path, nothing here
blocks Angular 22.

| Package                         | Latest   | Peer range                                          | Verdict for Angular 22 |
| ------------------------------- | -------- | --------------------------------------------------- | ---------------------- |
| `@analogjs/vite-plugin-angular` | `2.7.1`  | `vite ^6 \|\| ^7 \|\| ^8`, `@angular/build ^18–^22` | **Supported**          |
| `@module-federation/vite`       | `1.21.2` | `vite ^5 \|\| ^6 \|\| ^7 \|\| ^8`                   | **Supported**          |
| `vite`                          | 8.x      | —                                                   | matches both plugins   |
| `vite-plugin-zephyr`            | —        | —                                                   | optional stage 5       |

The Zephyr reference example (`zephyr-examples/module-federation/angular-vite`)
already runs Angular 21 + Vite 8, so it is a much closer starting point than the
Rsbuild example. Re-verify the table before starting anyway.

## 4. Where the code lives

```
builds/vite/
  package.json            npm workspace root for this pipeline
  tsconfig.base.json      path aliases into ../../projects/*/src
  shell/
    package.json
    vite.config.ts        angular() + federation(mfConfig)
    index.html            Vite convention: at the app root, not under src/
    src/{main.ts,bootstrap.ts,remotes.d.ts}
    src/app/              pipeline-specific composition seam only
  catalog/
    package.json
    vite.config.ts        exposes ./Routes
    index.html
    src/{main.ts,bootstrap.ts}
  orders/
    ... same shape
```

Ports: shell `5173`, catalog `5174`, orders `5175` (Vite convention, and it keeps
all three pipelines runnable simultaneously — which is a good demo in itself).

## 5. Implementation steps

### Step 1 — one app, no federation

```ts
// builds/vite/catalog/vite.config.ts
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [angular()],
  server: { port: 5174, origin: 'http://localhost:5174' },
  build: { target: 'chrome89' },
});
```

Checkpoints:

- SCSS resolves `@use 'tokens'`. Vite has no `stylePreprocessorOptions`; use
  `css.preprocessorOptions.scss.loadPaths` (Vite 5+ naming) pointing at
  `../../../styles`.
- Zoneless bootstrap. Both Zephyr Angular examples call
  `provideZonelessChangeDetection()` explicitly, whereas Angular 22 defaults to
  zoneless under the CLI; make it explicit here so the two pipelines cannot drift.
- `import '@angular/compiler'` — the Zephyr examples import it in `main.ts`.
  Determine whether AOT is actually in effect: if the JIT compiler is genuinely
  required, that is a bundle-size and startup difference worth measuring against
  the baseline's AOT output.
- Angular 22 template features and signal APIs compile.
- `server.origin` must be set, otherwise dev-mode asset URLs are relative and the
  host loads remote chunks from its own origin.

### Step 2 — expose the remote

```ts
import { federation } from '@module-federation/vite';

federation({
  name: 'catalog',
  filename: 'remoteEntry.js',
  exposes: { './Routes': '../../projects/catalog/src/app/catalog/catalog.routes.ts' },
  shared: {
    '@angular/core': { singleton: true, strictVersion: true },
    '@angular/common': { singleton: true, strictVersion: true },
    '@angular/platform-browser': { singleton: true, strictVersion: true },
    '@angular/router': { singleton: true, strictVersion: true },
    rxjs: { singleton: true },
  },
});
```

Same divergence as the Rspack build: the share map is hand-maintained, not derived
from `package.json` the way `shareAll()` does it.

### Step 3 — the host

```ts
federation({
  name: 'shell',
  filename: 'remoteEntry.js',
  remotes: {
    catalog: {
      type: 'module',
      name: 'catalog',
      entry: 'http://localhost:5174/remoteEntry.js',
      entryGlobalName: 'catalog',
      shareScope: 'default',
    },
    orders: {/* ...5175... */},
  },
  shared: {/* identical to the remotes */},
});
```

Composition seam — with `@module-federation/vite`, remotes are reachable as bare
specifiers, so the seam is a plain dynamic import plus an ambient declaration:

```ts
// src/remotes.d.ts
declare module 'catalog/Routes' {
  import type { Routes } from '@angular/router';
  export const routes: Routes;
}

// src/app/app/utils/remote/remote.util.ts
const LOADERS: Record<RemoteName, () => Promise<{ routes: Routes }>> = {
  catalog: () => import('catalog/Routes'),
  orders: () => import('orders/Routes'),
};

export async function loadRemoteRoutes(remote: RemoteName): Promise<Routes> {
  try {
    return (await LOADERS[remote]()).routes;
  } catch (error) {
    console.error(`[shell] could not load remote "${remote}"`, error);
    return remoteUnavailableRoutes(remote);
  }
}
```

Note what the hand-written `.d.ts` buys and costs: the host gets types for the
remote's surface, but they are **asserted, not verified**. Nothing checks that the
remote still exports `routes`. The baseline has the same property with an
`interface RemoteRoutesModule`; neither pipeline gives you a checked contract, and
that is a legitimate criticism of runtime composition in general.

`build.target` matters: MF's runtime uses top-level `await`, so a target below
`chrome89`/`es2022` breaks the remote entry.

### Step 4 — parity checklist

Identical to the Rspack plan — re-run the same list, because each item is a claim
the baseline makes:

- [ ] Both remotes render in the shell with correct styling.
- [ ] Exactly one `@angular/core` on the page, verified rather than assumed.
- [ ] Route-scoped `provideHttpClient` still isolates the two mock interceptors.
- [ ] Killing a remote produces the fallback, not a dead router.
- [ ] Each remote runs standalone.
- [ ] `vite build` output works when previewed (`vite preview`), not just in dev —
      Vite's dev and build paths differ enough that dev-only success is not proof.

Plus one Vite-specific item:

- [ ] `optimizeDeps` does not pre-bundle a **second** copy of `@angular/core` for
      the host. Vite's dependency pre-bundling and MF's share scope can disagree in
      dev; check the network panel in dev _and_ in preview.

### Step 5 — optional: Zephyr Cloud

`vite-plugin-zephyr` alongside `federation()`, plus `zephyr:dependencies` in
`package.json`, exactly as the Zephyr example does. Same rationale as in the Rspack
plan.

## 6. Risk register

| Risk                                                              | Likelihood | Mitigation                                                            |
| ----------------------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| `optimizeDeps` duplicates Angular in dev                          | Medium     | `optimizeDeps.exclude` for shared packages; verify in dev and preview |
| Dev works, `vite build` output does not                           | Medium     | Treat `vite preview` as the real checkpoint                           |
| JIT compiler shipped because `@angular/compiler` is imported      | Medium     | Test whether it can be dropped; if not, measure the cost              |
| Hand-written remote `.d.ts` drifts from the remote's real exports | Medium     | Generate it, or accept and state the gap                              |
| `build.target` too low for top-level await                        | Low        | Pin `chrome89`/`es2022`                                               |
| AnalogJS plugin lags an Angular minor                             | Low        | Currently supports `@angular/build ^22`; re-check before starting     |
| Angular CLI features lost (budgets, i18n, `ng test`, `ng update`) | Certain    | Same slide as the Rspack build                                        |

## 7. Acceptance criteria

1. `npm run dev` and `npm run build` + `npm run preview` work for all three apps.
2. The shell at `:5173` composes both remotes at runtime with one Angular instance,
   in dev **and** in preview.
3. Feature code is imported from `projects/*` with **zero** modifications.
4. The parity checklist passes, or every failure is documented.
5. A filled-in comparison row exists for the matrix in
   [`PLAN-RSPACK.md`](PLAN-RSPACK.md#7-what-the-talk-gets-from-this-build).

## 8. What the talk gets from this build

The Vite build is the interesting middle case, and the three-way comparison is the
payload of the talk:

- **Against the baseline** it isolates one variable — who owns the Vite instance.
  Angular already builds with Vite; the moment you need a plugin inside it, you
  leave the first-party pipeline and take ownership of the config, the upgrade
  cadence and everything the CLI was doing for you.
- **Against the Rspack build** it shows that "custom pipeline" is not one decision.
  The Vite path currently tracks Angular closely; the Nx Rsbuild adapter the public
  examples use is capped below Angular 21 while its Rspack successor is not. Same
  category of choice, materially different maintenance exposure — and the exposure
  moved between the two adapters, which is the point.
- **Against both**, the baseline is the control: it is the only one of the three
  where Angular's release notes are also your migration guide.
