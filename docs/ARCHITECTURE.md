# Architecture

How the five applications in this workspace are wired, which boundaries are
deliberate, and what each choice costs.

**Scope:** this document describes **build 1** — the Angular CLI + Native
Federation baseline in `projects/`. The two custom pipelines that rebuild the same
five applications are written up separately in
[`PLAN-RSBUILD.md`](PLAN-RSBUILD.md) and [`PLAN-VITE.md`](PLAN-VITE.md).

---

## 1. Five applications, one page

`angular.json` holds **five** application projects — a host, two page remotes and
two widget microfrontends. Each has **two** build targets:

| Target            | Builder                                       | Purpose                                                    |
| ----------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `esbuild`         | `@angular/build:application`                  | The ordinary Angular build. Nothing federation-specific.   |
| `build` / `serve` | `@angular-architects/native-federation:build` | Wraps the target above and emits the federation artefacts. |

That layering is the central point of the baseline: Native Federation **wraps**
the builder Angular ships rather than replacing it. Upgrades, budgets, SCSS,
source maps and the dev server all remain first-party behaviour. The federation
plugin adds artefacts (`remoteEntry.json`, `importmap.json`, shared chunks) and a
runtime, not a new compiler.

The `test` target points explicitly at `<project>:esbuild:development`, because
`@angular/build:unit-test` only understands the application builder — and specs
never exercise the federation runtime anyway.

## 2. Boot order

A federated page has to agree on shared dependencies _before_ any of them is
evaluated. Hence the two-phase entry point in `projects/shell/src/main.ts`:

```ts
initFederation('federation.manifest.json', { shimMode: false })
  .then((runtime) => {
    setFederation(runtime);
    return import('./bootstrap');
  })
  .catch((err) => console.error(err));
```

- `main.ts` imports nothing from Angular. `bootstrap.ts` — a **dynamic** import —
  is the first module that does.
- The shell publishes its own `remoteEntry.json` (13 shared packages, an empty
  `exposes`), so the host's shared dependencies take part in the same negotiation
  as the remotes' instead of being a special case. The Angular adapter does this
  on its own — the explicit `hostRemoteEntry` option earlier versions needed is
  gone.
- `shimMode: false` installs the import map with the browser's **native** import
  maps rather than `es-module-shims`. The builder's `esmsInitOptions` must agree,
  or the entry stays `type="module-shim"` while the runtime expects native
  resolution.
- `setFederation` stores the returned handle in `src/federation.ts`. Native
  Federation also exports a module-scoped `loadRemoteModule`, but it resolves
  against whichever `initFederation` call ran last — brittle in tests and
  multi-host setups, and now marked deprecated. Keeping the handle makes the
  ordering dependency explicit: nothing can load a remote before the runtime is
  ready.

All four remotes run the same two-phase boot with an empty remote map, so a
remote served standalone behaves exactly like the federated one.

## 3. Two kinds of application, two contracts

The shell composes at two granularities, and each is a different _kind_ of
application rather than two flavours of the same one.

| Kind                 | Owns          | Exposes     | Has a router | Adding one costs                 |
| -------------------- | ------------- | ----------- | ------------ | -------------------------------- |
| Page remote          | a URL subtree | `./Routes`  | yes          | a shell code change (a route)    |
| Widget microfrontend | one component | `./Widgets` | **no**       | two JSON edits, no shell rebuild |

A whole URL subtree, in `projects/shell/src/app/app/app.routes.ts`:

```ts
{ path: 'catalog', loadChildren: () => loadRemoteRoutes('catalog') },
{ path: 'orders',  loadChildren: () => loadRemoteRoutes('orders') },
```

…and single components inside a page the shell owns, in
`projects/shell/src/app/home/containers/home/home.component.html`:

```html
@defer (on viewport) { @for (slot of slots(); track slot.remote + '/' + slot.widget) {
<shl-remote-slot [remote]="slot.remote" [widget]="slot.widget" [heading]="slot.heading" />
} }
```

Note what is _not_ in that template: any application's name. `slots()` comes from
`projects/shell/public/widget-slots.json`, so which widget microfrontends exist and
where they go is data. Adding one is an entry there plus an entry in the federation
manifest — the shell is not recompiled and this file does not change.

That is also why `RemoteName` is `string` and not `'catalog' | 'orders'`. The union
meant the _set_ of remotes was compiled into the host, however much the manifest
looked like data — a precision the earlier version of this document got wrong.

There is no `import` of anything under another project anywhere in the shell — no
components, no models, no enums, not even a type. The contract is a name, an
exposed key, and a URL.

### Why a widget microfrontend exposes a descriptor, not a component

A route table is the right contract when an application should own a whole URL
subtree: it keeps its own lazy boundaries, its own providers and its own internal
URLs, and the host writes one `loadChildren`. What it cannot do is put a remote's
component inside a page the _host_ owns — which is the entire job of a widget
microfrontend.

It is tempting to argue that a component contract would force the host to decide
how the component is lazily loaded, what providers surround it and what its inputs
are. That is only true if the remote exposes a bare component class. Expose a
**descriptor** instead and all three stay on the remote side:

```ts
// projects/top-lots/src/app/top-lots/top-lots.widgets.ts   — exposed as './Widgets'
{
  id: 'top-lots',
  label: 'Top scoring lots',
  load: () => import('./containers/top-lots-widget/top-lots-widget.component').then((m) => ({
    component: m.TopLotsWidgetComponent,
    providers: [provideHttpClient(withInterceptors([topLotsMockInterceptor])), TopLotsService],
  })),
}
```

The host loads `./Widgets`, finds the id, calls `load()`, and drops the returned
`providers` into a child `EnvironmentInjector` it never inspects. `providers` is
the same array `Route.providers` carries, so a widget's HTTP stack and feature
service are scoped exactly as they are on the routed path.

That yields two nested lazy levels, both owned by the remote:

| Level | Fetches                                          | Triggered by                                 |
| ----- | ------------------------------------------------ | -------------------------------------------- |
| 1     | the remote's `Widgets.js` (descriptor list only) | `shl-remote-slot`, on `@defer (on viewport)` |
| 2     | the widget's own component chunk                 | the descriptor's inner `import()`            |

`@defer` and federation do different jobs here, and it is worth saying out loud:
`@defer` can only defer dependencies the compiler can see statically, so what it
defers is the shell's _own_ `RemoteSlotComponent`. The cross-origin fetch happens
inside that component. `@defer` supplies the trigger ergonomics — `on viewport`,
`on interaction`, `on idle`, `prefetch` — and federation supplies the module.

### One manifest key, or many flat keys?

Production classic-MF deployments tend to expose many flat keys rather than one
manifest. `shop.lululemon.com` registers 12 remotes and instantiates 3 on its
homepage; its `layout` remote alone exposes `./Root`, `./atoms/layout`,
`./atoms/config` and `./utils/getNavData` — components, shared state and plain
functions, at a granularity well below the page. Nothing there exposes a route
table.

This workspace takes the other option, deliberately. One `./Widgets` key means the
host _discovers_ what a remote offers at runtime instead of hardcoding
`catalog/TopLots`, and a new widget needs no federation-config change and no shell
change. The cost is one small extra fetch before anything can render, and a
descriptor shape that both sides declare independently — see §10.

### Failure has two shapes now

A slot distinguishes them, because the fixes differ: **unreachable** means the
remote did not answer and someone should start it; **not found** means the remote
answered but publishes no such id — a typo, or a version skew between a deployed
shell and an older remote. Collapsing both into one empty state throws away the
only information that helps.

### The manifest is data, not code

`projects/shell/public/federation.manifest.json` is a static asset:

```json
{
  "catalog": "http://localhost:4201/remoteEntry.json",
  "orders": "http://localhost:4202/remoteEntry.json"
}
```

Pointing the shell at a different environment is a file edit, not a rebuild. The
`RemoteRegistry` service on the overview page reads that same file and probes each
entry, so the shell can show its topology instead of only discovering a problem at
navigation time.

## 4. Sharing policy

All five `federation.config.mjs` files use the same `shareAll` policy:

```js
shareAll(
  { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package' },
  {
    overrides: {
      '@angular/core': { /* ...same... */ includeSecondaries: { keepAll: true } },
    },
  },
);
```

- `singleton: true` — one instance per package on the page. Without it, shell and
  remote get separate `@angular/core` copies, and `EnvironmentInjector`
  propagation, `NgZone` identity and any RxJS subject crossing the boundary break
  in ways that surface as baffling runtime errors, not build errors.
- `strictVersion: true` — a version conflict fails loudly instead of silently
  loading two copies.
- `requiredVersion: 'auto'` — read from `package.json` rather than hand-maintained.
- `includeSecondaries: { keepAll: true }` on `@angular/core` — opts that package
  out of `ignoreUnusedDeps`, so secondary entry points (`@angular/core/rxjs-interop`
  and friends) can never be resolved from a second copy.
- `denseChunking: true` — groups chunks in `remoteEntry.json` to keep the metadata
  file small. The shell and both page remotes currently declare 13 shared
  packages; the two widget microfrontends declare 11, because neither imports
  `@angular/router` and the share map is derived from what the exposed entry point
  actually uses.

`skip` drops the RxJS entry points nothing in this workspace imports at runtime.

## 5. Where the backend lives

Each remote ships its own mocked backend and provides it **at route level** — and, for a widget, in the descriptor's `providers`, which is the same array shape:

```ts
// projects/catalog/src/app/catalog/catalog.routes.ts
{
  path: '',
  providers: [provideHttpClient(withInterceptors([catalogMockInterceptor])), CatalogService],
  loadComponent: () =>
    import('./containers/catalog-view/catalog-view.component').then((m) => m.CatalogViewComponent),
}
```

Three consequences worth stating out loud:

1. **The shell provides no HTTP of its own.** Look at `app.config.ts`: there is no
   `provideHttpClient`. When the shell needs the network itself — the remote-health
   probe — it uses `fetch` directly, so this property is not quietly undone.

   Be precise about what that buys, because it is easy to overstate. In Angular 22
   `HttpClient`, `HttpHandler` and `HttpBackend` are all `providedIn: 'root'` with
   a fetch backend, so `inject(HttpClient)` succeeds in any application whether or
   not anyone called `provideHttpClient`. What is _not_ root-provided is the
   **interceptor chain**: `HttpInterceptorHandler` resolves interceptors from the
   `EnvironmentInjector` it was created in. So the real guarantee is that no
   shell-level interceptor sits above a remote's traffic, and that each remote's
   own mock backend is reached through the injector the remote described.
   `app.config.spec.ts` asserts the shell installs none.

2. **Two interceptor chains coexist.** The catalog's mock answers `/api/beans`;
   the orders mock answers `/api/orders`. Neither can see the other's traffic,
   because each lives in its own scoped injector — route-scoped when routed,
   slot-scoped when mounted as a widget. Root-provided interceptors would have made
   them fight over the same chain. The observable proof is on `/home`: both widgets
   render seeded data from their own mock, in one document, at the same time.
3. **Feature services use `@Service({ autoProvided: false })`.** A root-provided
   singleton would be created in whichever injector happens to be around — the
   shell's, in federated mode. Listing the service in the route providers ties its
   lifetime to the feature.

The mocks implement a **server-driven** contract: filtering, sorting, paging and
aggregation all happen "server side", and the client holds one page at a time.
Swapping a mock for a real endpoint is a one-line change in the service, with no
change to any component. Both mocks are deterministic — generated from fixed
indices, and `orders` computes due dates against a fixed `referenceToday` — so a
demo shows the same figures on the second run and specs need no frozen clock.

## 6. Styling across the boundary

The remote's global stylesheet is **never loaded by the shell**. Only component
styles travel with a federated component. That is why
`projects/<project>/styles/_tokens.scss` exposes **SCSS variables and mixins**,
not CSS custom properties: compile-time values are baked into each component's
own styles by that component's own build, so they survive the crossing. A
`var(--token)` defined only in the remote's `styles.scss` would resolve to
nothing inside the shell.

Each project owns its own `styles/` folder, wired in through that project's
`stylePreprocessorOptions.includePaths`. The five copies of `_tokens.scss` and
`_base.scss` are **byte-identical duplicates**, which leaves the workspace with
**no build-time coupling between the five applications at all** — none of them
reads a sibling's file for any purpose, in any phase.

The cost is drift: edit one copy and nothing tells you the other four are stale.
`diff` between any two is the check. The reason to accept that cost here is that
tokens are inlined into every consuming component anyway (see the duplication
figures above), so a single shared file was never buying deduplicated output —
only deduplicated authoring. The way to buy that back properly is a published
styles library package consumed as a versioned dependency, which is what the
header comment in `_tokens.scss` points at; it needs its own build, registry and
release cadence, so it is out of scope for a demo workspace.

The "Rendered by the … remote" strip is duplicated in all four remotes on
purpose — the shell has no copy, because it is never the thing being rendered
_by_ a remote. A
shared UI library would be exactly the build-time dependency federation exists to
avoid. Each copy reads its own origin from `import.meta.url`, so it prints `:4201`
or `:4202` even while rendering inside the shell's document at `:4200`.

## 7. Failure is a normal operating condition

Composition happens at runtime, so a remote being down is a deployment condition,
not a build error. `loadRemoteRoutes` catches it and returns a fallback route
table rendering `RemoteUnavailable` from the shell:

```ts
try {
  const module = await federation().loadRemoteModule(remote, exposedRoutes);
  return module.routes;
} catch (error) {
  console.error(`[shell] could not load remote "${remote}" (${exposedRoutes})`, error);
  return remoteUnavailableRoutes(remote);
}
```

Letting the rejection escape would leave the router on the previous URL with no
feedback. The fallback keeps navigation and the rest of the shell alive and tells
the user which remote failed and how to start it.

This path is unit-tested rather than only demoed: in `app.routes.spec.ts` the
federation runtime is never initialised, so calling `loadChildren()` takes exactly
the code path a down remote takes in production.

## 8. Testing layering

42 specs, no browser required:

| Level             | Where                                               | What it protects                                            |
| ----------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| Mock backend      | `*-mock.interceptor.spec.ts`                        | The API contract: paging, filters, sort, facets, aggregates |
| Service           | `catalog.service.spec.ts`, `orders.service.spec.ts` | Query-param encoding, via `HttpTestingController`           |
| Shell composition | `app.routes.spec.ts`                                | Route table shape, lazy loading, and the fallback path      |
| Shell runtime     | `remote-registry.service.spec.ts`                   | Manifest reading and health mapping, with `fetch` stubbed   |

What is deliberately **not** unit-tested is the federation runtime itself: shared
version negotiation and import-map installation are integration behaviour. Under
`ng test` the runtime is absent, which is what makes the fallback test honest. A
real shell↔remote wiring check belongs in an e2e run against three dev servers
(out of scope here; noted as the gap it is).

## 9. What changed since Native Federation 21

The `adg-coding-challenge` repo runs Native Federation 21 on Angular 21. Moving to
22 changed the generated wiring in ways worth knowing before reading either repo:

| Area               | NF 21 (`adg-coding-challenge`)    | NF 22 (this repo)                                                     |
| ------------------ | --------------------------------- | --------------------------------------------------------------------- |
| Config file        | `federation.config.js` (CommonJS) | `federation.config.mjs` (ESM, `export default`)                       |
| Federation program | implicit                          | explicit `tsconfig.federation.json` per project, passed as `tsConfig` |
| Host entry         | host consumed only                | hosts publish a `remoteEntry.json` too — now automatic, no option     |
| Runtime handle     | module-scoped `loadRemoteModule`  | handle returned by `initFederation`; the global helper is deprecated  |
| Shared build       | n/a                               | `build: 'package'`                                                    |
| Chunk metadata     | n/a                               | `features.denseChunking`                                              |
| Unused deps        | `features.ignoreUnusedDeps: true` | on by default; `includeSecondaries` is how you opt out                |
| Orchestrator       | `@softarc/native-federation-node` | `@softarc/native-federation-orchestrator`                             |
| Shims              | `es-module-shims` ^1.x            | opted out — `shimMode: false` + native import maps                    |

## 10. Trade-offs this baseline accepts

Most of these are inherent to _any_ federation runtime, not to Native Federation.
They were the material for the comparison with the Rspack and Vite builds, both of
which are now implemented — see [`PLAN-RSBUILD.md`](PLAN-RSBUILD.md) and
[`PLAN-VITE.md`](PLAN-VITE.md) for how each trade-off actually landed.

| Topic                         | Position taken here                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Builder ownership**         | Stay on `@angular/build:application`. Upgrades follow Angular's release notes; no bundler stack to own. This is the whole point of the baseline.                                                                                                                                                                                                                                                                                                                   |
| **Bundler still required**    | The "no bundler" pitch of raw ESM does not apply. Tree-shaking, code splitting, CSS pipelines, TS, source maps and budgets all still live in the bundler.                                                                                                                                                                                                                                                                                                          |
| **Cross-origin posture**      | Chunks are fetched cross-origin (`:4201` → `:4200`). The dev server allows it; production needs explicit CORS headers, cache rules and SBOM coverage of every origin.                                                                                                                                                                                                                                                                                              |
| **Cross-origin DX cost**      | Source maps and stack traces straddle two origins. Fine for a demo; in many-team setups a unified delivery layer (per-team prefixes on one CDN, or a platform like Zephyr) pays off.                                                                                                                                                                                                                                                                               |
| **No unload semantics**       | ESM cannot unload a module. Long-lived multi-remote shells that need memory recovery reach `registerRemotes(..., { force: true })` / `removeRemote()` through classic MF.                                                                                                                                                                                                                                                                                          |
| **Single Angular major**      | Layered singletons — the same specifier as _different_ singletons per layer, e.g. two Angular majors side by side — remain a classic-MF capability. Not needed for one major version.                                                                                                                                                                                                                                                                              |
| **Loader hooks**              | NF covers retries, fallbacks and telemetry. The broader MF hook surface (`beforeLoadRemote`, `errorLoadRemote`, `afterResolve`) is reachable via the documented combination pattern.                                                                                                                                                                                                                                                                               |
| **Duplicated feature layers** | A widget microfrontend may not import from a page remote, so `top-lots` ships its own service, interceptor, seed, models and enums rather than reusing `catalog`'s. Consequence to state out loud: its numbers do not match `/catalog`'s, because it is a different application with a different backend. At five projects a published contracts package is the correct answer, not a hypothetical one.                                                            |
| **Registration is not free**  | All five entries sit in `federation.manifest.json`, so every `remoteEntry.json` is fetched and negotiated during bootstrap — before Angular starts — whether or not anything mounts. Loading is lazy; registration is not. A deployment with a dozen widget MFEs should register them lazily via `initRemoteEntry` instead.                                                                                                                                        |
| **Duplicated style tokens**   | `_tokens.scss` and `_base.scss` exist as five byte-identical copies, not one shared file. Documented above as a deliberate trade rather than an oversight — and past the point where the header comment says a published package becomes correct.                                                                                                                                                                                                                  |
| **No e2e**                    | Shell↔remote wiring is only verified manually. The honest gap in the test story. Every project does now carry at least one spec, because `@angular/build:unit-test` fails a target outright when a project has none — which silently breaks `npm test` for the whole workspace.                                                                                                                                                                                    |
| **Descriptor asserted twice** | `./Routes` is typed `Routes`, owned by `@angular/router`, so both sides are structurally guaranteed to agree. The widget descriptor is a bespoke shape declared independently in the shell and in each remote, and nothing checks that they still match. Each remote's `/widgets` gallery is the mitigation: it consumes the descriptor list inside the remote's own build, so a broken descriptor fails in that remote's dev server rather than only in the host. |
| **Manifest vs flat keys**     | One `./Widgets` key buys runtime discoverability and costs an extra round trip before first paint. Flat per-widget keys invert that. Build 2 did **not** measure both — it ported the single-descriptor form unchanged, so this remains open (`PLAN-RSBUILD.md` §3.8).                                                                                                                                                                                             |
| **Dev-server staleness**      | A running `ng serve` does not pick up a new `exposes` key — it serves a `remoteEntry.json` without it while serving the chunk, so the host reports "unreachable" with nothing in the log. Restart the remote after touching `federation.config.mjs`.                                                                                                                                                                                                               |
| **Experimental API**          | `debounced()` from `@angular/core` is experimental in v22. Used in both containers because it replaces the RxJS `debounceTime` ceremony; swap for a `FormControl` pipeline if that matters.                                                                                                                                                                                                                                                                        |

## Further reading

- [Native Federation README](https://github.com/angular-architects/module-federation-plugin/blob/main/libs/native-federation/README.md)
- [Native Federation for Angular 17.1+ (Application Builder)](https://www.angulararchitects.io/en/blog/announcing-native-federation-for-angular-17-1/)
- [Combining Native Federation and Module Federation](https://www.angulararchitects.io/en/blog/combining-native-federation-and-module-federation/)
- [Module Federation vs Native ESM](https://zephyr-cloud.io/blog/module-federation-vs-native-esm) — why a federation _runtime_ is needed even when the _transport_ is plain ESM
- [Angular custom build pipeline](https://angular.dev/ecosystem/custom-build-pipeline) — Angular's own framing of when to leave the default builder
