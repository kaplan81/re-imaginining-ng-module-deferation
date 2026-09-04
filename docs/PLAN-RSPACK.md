# Plan — build 2: Rspack + Module Federation

Second of the three builds in the talk. Same product, same application code, a
**different build pipeline and a different federation runtime**: Rspack instead of
esbuild, classic Module Federation instead of Native Federation.

Status: **planned, not implemented.**

---

## 1. Goal

Rebuild _Roast Republic_ — shell + `catalog` + `orders` + `top-lots` +
`roast-queue` — so that:

- Angular is compiled by **Rspack**, not by `@angular/build:application`.
- Composition uses **classic Module Federation** (`mf-manifest.json`,
  `ModuleFederationPlugin`, the MF runtime), not import maps.
- The **feature code is byte-identical** to the baseline. If the pipeline is the
  only variable, every difference the talk shows is attributable to the pipeline.

## 2. Verified version constraints

Checked against npm at the time of writing. This matters: the reference example in
`zephyr-examples/module-federation/angular-rsbuild` pins **Angular 20** and says
so explicitly, so it cannot be copied onto this Angular 22 workspace.

| Package                       | Latest   | Peer range                                                     | Verdict for Angular 22                              |
| ----------------------------- | -------- | -------------------------------------------------------------- | --------------------------------------------------- |
| `@nx/angular-rsbuild`         | `21.2.0` | `@angular/common >=19 <21`                                     | **Unusable** — this is what the Zephyr example uses |
| `@nx/angular-rspack`          | `23.1.3` | `@angular/build >=20 <23`, `@rspack/core ^2 \|\| >=1.3.5 <1.7` | **Use this** — the successor adapter                |
| `@nx/angular-rspack-compiler` | `23.1.3` | `@angular/build >=20 <23`                                      | pulled in transitively                              |
| `@module-federation/rspack`   | `2.9.0`  | `@rspack/core ^0.7 \|\| ^1 \|\| ^2`                            | federation plugin                                   |
| `@module-federation/enhanced` | `2.9.0`  | `webpack ^5`                                                   | runtime APIs (`loadRemote`, `registerRemotes`)      |
| `zephyr-rspack-plugin`        | —        | —                                                              | optional stage 5                                    |

**First task of the implementation is to re-verify this table**, because the Nx
adapter is the moving part and `<23.0.0` will eventually mean "not Angular 23".

## 3. Where the code lives

```
builds/rspack/
  package.json            npm workspace root for this pipeline
  tsconfig.base.json      path aliases into ../../projects/*/src
  shell/
    package.json
    rspack.config.ts      createConfig(...) + ModuleFederationPlugin
    src/{index.html,main.ts,bootstrap.ts,remotes.d.ts}
    src/app/              pipeline-specific composition seam only
  catalog/
    package.json
    rspack.config.ts      exposes ./Routes
    src/{index.html,main.ts,bootstrap.ts}
  orders/
    ... same shape
```

Register `builds/rspack/*` as npm workspaces in the root `package.json` so one
`npm install` covers everything, and the talk can switch pipelines by switching
terminal, not repository.

### The one thing that is shared, and why

`builds/rspack/tsconfig.base.json` maps the feature code back into the CLI
workspace:

```json
{
  "compilerOptions": {
    "paths": {
      "@rr/catalog/*": ["../../projects/catalog/src/app/catalog/*"],
      "@rr/orders/*": ["../../projects/orders/src/app/orders/*"],
      "@rr/styles/*": ["../../styles/*"]
    }
  }
}
```

Sharing a source tree across pipelines is precisely the build-time coupling the
baseline avoids _between applications_. Here it is deliberate and in the opposite
direction: it makes the pipeline the only independent variable. Say this out loud
in the talk — it is the difference between a fair comparison and three unrelated
demos.

## 4. Implementation steps

### Step 1 — one app, no federation

Get `catalog` compiling and serving through Rspack alone.

```ts
// builds/rspack/catalog/rspack.config.ts
import { createConfig } from '@nx/angular-rspack';

export default createConfig({
  options: {
    browser: './src/main.ts',
    index: './src/index.html',
    styles: ['./src/styles.scss'],
    outputPath: './dist',
    outputHashing: 'none',
    devServer: { port: 4211 },
  },
});
```

Checkpoints before going further:

- SCSS with `includePaths` for each project's `styles/` resolves (the adapter bundles `sass` and
  `sass-loader`; the option name differs from `stylePreprocessorOptions`).
- Zoneless bootstrap works. `@nx/angular-rspack` still lists `zone.js` as a peer;
  Angular 22 defaults to zoneless, so confirm no `zone.js` import is injected.
- `import.meta.url` survives the Rspack module wrapper — the "Rendered by …" strip
  depends on it. If it does not, inject the origin via `DefinePlugin` instead.
- Angular 22 template syntax (`@if`, `@for`, `@switch`, signal inputs) compiles
  through `@nx/angular-rspack-compiler`.

Timebox this step. If the adapter cannot build Angular 22 at all, that finding is
itself talk content, and the fallback is to pin this build to the newest Angular
the adapter does support and label the version skew on the slide.

### Step 2 — expose the remote

```ts
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';

const shared = {
  '@angular/core': { singleton: true, strictVersion: true, requiredVersion: '^22.1.0' },
  '@angular/common': { singleton: true, strictVersion: true, requiredVersion: '^22.1.0' },
  '@angular/platform-browser': { singleton: true, strictVersion: true, requiredVersion: '^22.1.0' },
  '@angular/router': { singleton: true, strictVersion: true, requiredVersion: '^22.1.0' },
  rxjs: { singleton: true },
};

new ModuleFederationPlugin({
  name: 'catalog',
  filename: 'remoteEntry.js',
  exposes: {
    './Routes': '@rr/catalog/catalog.routes',
    './Widgets': '@rr/catalog/catalog.widgets',
  },
  shared,
});
```

Note the first real divergence: Native Federation's `shareAll(...)` derives the
whole share map from `package.json`; here the share map is **hand-maintained**.
Every Angular package the remotes have in common must be listed on both sides, and
`requiredVersion` strings drift on upgrade. Count the lines and mention the
maintenance cost.

Verify `dist/mf-manifest.json` and `dist/remoteEntry.js` are emitted and that the
manifest lists both `./Routes` and `./Widgets`.

**Five applications, not three.** Two of them (`top-lots`, `roast-queue`) are
widget microfrontends: they expose only `./Widgets`, have no router and no route
table, and are declared to the shell entirely in `federation.manifest.json` +
`widget-slots.json`. Porting them is the easier half — no routing to reconcile —
but the host's slot component and its two config assets are part of the
`src/app/` composition seam that step 3 rewrites.

**`./Widgets` must port unchanged, and it needs no adapter.** The descriptor in
`catalog.widgets.ts` is plain `@angular/core` — `Type`, `Provider |
EnvironmentProviders`, and a bare dynamic `import()`. No federation API appears in
it, which is exactly why it can sit inside the aliased feature tree and satisfy
criterion 3. On the host side `loadRemote('catalog/Widgets')` returns the same
module object that `federation().loadRemoteModule('catalog', './Widgets')` returns
in the baseline, so `RemoteSlotComponent` should port with only its loader call
rewritten.

**Bridges are out of scope, and that is a finding rather than a gap.** MF Bridge
ships officially for React and Vue 3 only — there is no Angular bridge — and its
provider contract is DOM-based (`render({ dom })` / `destroy({ dom })`), which
would mean a second `ApplicationRef` per remote and no injector inheritance from
the host. It exists to cross _framework_ boundaries. Worth saying on the slide:
`shop.lululemon.com` runs 12 remotes with zero bridges, because everything there
is React and `react`/`react-dom`/`next/*`/`jotai` are simply shared singletons —
the same posture `shareAll` gives the baseline.

**Comparison task: flat keys vs one manifest key.** The baseline exposes a single
`./Widgets` descriptor list, so the host discovers what a remote offers at runtime.
Production MF tends the other way — lululemon's `layout` remote exposes `./Root`,
`./atoms/layout`, `./atoms/config` and `./utils/getNavData` as separate flat keys,
and its host hardcodes them. Implement one widget both ways here and measure the
round trips and the config churn per added widget.

**Production details from that survey worth reproducing or avoiding:** remote
versions pinned in the URL path (`…/layout/11.22.39/static/chunks/remoteEntry.js`)
with `_app_version_` placeholders substituted at load time; remotes that are
themselves hosts (`story-app` registers `layout`); and — the cautionary one — those
nested registrations pointing at `stage.lululemon.com` from production, which is
what a compiled-in remote URL costs you when the baseline's manifest-as-data would
have been an edit.

### Step 3 — the host

Static remotes are declared in the plugin:

```ts
new ModuleFederationPlugin({
  name: 'shell',
  remotes: {
    catalog: 'catalog@http://localhost:4211/mf-manifest.json',
    orders: 'orders@http://localhost:4212/mf-manifest.json',
  },
  shared,
});
```

Then rewrite **only** the composition seam. The baseline's
`utils/remote/remote.util.ts` becomes:

```ts
import { loadRemote } from '@module-federation/enhanced/runtime';

export async function loadRemoteRoutes(remote: RemoteName): Promise<Routes> {
  try {
    const module = await loadRemote<{ routes: Routes }>(`${remote}/Routes`);
    return module!.routes;
  } catch (error) {
    console.error(`[shell] could not load remote "${remote}"`, error);
    return remoteUnavailableRoutes(remote);
  }
}
```

Everything else in the shell — routes, header, home page, fallback component —
should port unchanged. **If it does not, that is a finding, not a bug to hide.**

Two host details to work out:

- **`import '@angular/compiler'`** — both Zephyr Angular examples import it in
  `bootstrap.ts`. Determine whether the JIT compiler is genuinely required or
  whether it is a leftover; a shipped compiler is a real bundle-size difference
  worth measuring.
- **Dynamic remotes.** The MF equivalent of the baseline's editable
  `federation.manifest.json` is `registerRemotes()` at runtime plus a fetched
  config. Either implement it (keeps parity with the baseline's "edit a file, no
  rebuild" property) or state the gap explicitly. Static `remotes` bake URLs into
  the host bundle — a genuine behavioural difference, not just syntax.

### Step 4 — parity checklist

Nothing here is "extra polish"; each item is a claim the talk makes about the
baseline that must be re-tested on this pipeline.

- [ ] Both remotes render inside the shell with correct styling (component styles
      cross the boundary; the remote's global stylesheet must not be needed).
- [ ] Exactly **one** `@angular/core` on the page. Verify, do not assume:
      `Array.from(document.querySelectorAll('script[src]')).map((s) => s.src)`
      plus a check that `inject()` across the boundary resolves shell providers.
- [ ] Route-scoped `provideHttpClient` still isolates the two mock interceptors.
- [ ] Killing a remote produces the fallback, not a dead router.
- [ ] Each remote still runs standalone on its own port.
- [ ] Production build succeeds and emits comparable artefacts.

### Step 5 — optional: Zephyr Cloud

Add `zephyr-rspack-plugin` and `zephyr:dependencies` as the Zephyr example does.
This is the deployment-and-resolution layer rather than the bundler layer — worth
a slide because it addresses the cross-origin DX cost listed in
[`ARCHITECTURE.md`](ARCHITECTURE.md#10-trade-offs-this-baseline-accepts), which no
bundler choice fixes on its own.

## 5. Risk register

| Risk                                                                        | Likelihood | Mitigation                                                                              |
| --------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| Nx adapter lags the Angular major (already true for `@nx/angular-rsbuild`)  | High       | Verify peers first; be willing to pin this build to an older Angular and label the skew |
| Hand-maintained `shared` map drifts from `package.json`                     | High       | Generate it from `package.json` in the config; measure how much code that takes         |
| Zoneless / signal-forms / v22 template features unsupported by the compiler | Medium     | Test in step 1 before any federation work                                               |
| `import.meta.url` rewritten by the module wrapper                           | Medium     | `DefinePlugin` fallback for the origin strip                                            |
| Two dev servers with different HMR protocols confuse each other             | Medium     | Distinct ports (4210–4212), no shared HMR endpoint                                      |
| Angular CLI features silently lost (budgets, i18n, `ng test`, `ng update`)  | Certain    | Enumerate them on a slide — this _is_ the maintenance-cost argument                     |

## 6. Acceptance criteria

1. `npm run build` and `npm run dev` work for all three apps under `builds/rspack/`.
2. The shell at `:4210` composes both remotes at runtime with one Angular instance.
3. Feature code is imported from `projects/*` with **zero** modifications —
   including `<remote>.widgets.ts` and both widget containers.
4. The parity checklist in step 4 passes, or every failure is documented.
5. A filled-in comparison row exists for the matrix below.

## 7. What the talk gets from this build

| Dimension                          | Baseline (Native Federation) | This build (Rspack + MF)             |
| ---------------------------------- | ---------------------------- | ------------------------------------ |
| Cold production build, 3 apps      | measure                      | measure                              |
| Incremental rebuild on file save   | measure                      | measure                              |
| Initial transferred bytes, shell   | ~36.7 kB gzip                | measure                              |
| Lines of build/federation config   | count                        | count                                |
| Shared-dep map: derived or manual  | derived (`shareAll`)         | manual                               |
| Remote URLs: data or compiled      | data (manifest asset)        | compiled, unless `registerRemotes`   |
| `ng update` migration path         | yes                          | no — adapter's own cadence           |
| `ng test`, budgets, i18n           | first-party                  | re-solve per feature                 |
| Component-level exposure           | one `./Widgets` descriptor   | measure: flat keys or manifest       |
| Adapter needed for Angular→Angular | none                         | none (Bridge is for cross-framework) |
| Angular version ceiling            | tracks Angular               | set by the adapter                   |
| Unload / layered singletons        | not available                | available                            |
