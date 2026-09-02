# Architecture

How the three applications in this workspace are wired, which boundaries are
deliberate, and what each choice costs.

---

## 1. Three builds, one page

`angular.json` holds three application projects. Each has **two** build targets:

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
initFederation('federation.manifest.json', {
  hostRemoteEntry: { url: './remoteEntry.json' },
})
  .then((runtime) => {
    setFederation(runtime);
    return import('./bootstrap');
  })
  .catch((err) => console.error(err));
```

- `main.ts` imports nothing from Angular. `bootstrap.ts` — a **dynamic** import —
  is the first module that does.
- `hostRemoteEntry` makes the shell publish its own `remoteEntry.json`, so the
  host's shared dependencies take part in the same negotiation as the remotes'
  instead of being a special case.
- `setFederation` stores the returned handle in `src/federation.ts`. Native
  Federation also exports a module-scoped `loadRemoteModule`, but it resolves
  against whichever `initFederation` call ran last — brittle in tests and
  multi-host setups, and now marked deprecated. Keeping the handle makes the
  ordering dependency explicit: nothing can load a remote before the runtime is
  ready.

Both remotes run the same two-phase boot with an empty remote map, so a remote
served standalone behaves exactly like the federated one.

## 3. The only link between shell and remotes

`projects/shell/src/app/app/app.routes.ts`:

```ts
{ path: 'catalog', loadChildren: () => loadRemoteRoutes('catalog') },
{ path: 'orders',  loadChildren: () => loadRemoteRoutes('orders') },
```

There is no `import` of anything under `projects/catalog` or `projects/orders`
anywhere in the shell — no components, no models, no enums, not even a type. The
contract is three strings: the remote's name, the exposed key `./Routes`, and the
URL in `federation.manifest.json`.

**Why expose a route table rather than a component?** A component forces the host
to decide how it is lazily loaded, what providers surround it and what its inputs
are. A route table lets the remote keep all of that: its own lazy boundaries, its
own providers, its own internal URLs. Both remotes expose the same key, so the
shell composes them through one code path with no per-remote special casing.

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

Both `federation.config.mjs` files use the same `shareAll` policy:

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
  file small. Each remote currently declares 13 shared packages.

`skip` drops the RxJS entry points nothing in this workspace imports at runtime.

## 5. Where the backend lives

Each remote ships its own mocked backend and provides it **at route level**:

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

1. **The shell has no `HttpClient`.** Look at `app.config.ts`: there is no
   `provideHttpClient`. A remote therefore cannot inherit a base URL, an
   interceptor chain or an auth token from the host by accident. When the shell
   needs to talk to the network itself — the remote-health probe — it uses `fetch`
   directly, so this property is not quietly undone.
2. **Two interceptor chains coexist.** The catalog's mock answers `/api/beans`;
   the orders mock answers `/api/orders`. Neither can see the other's traffic,
   because each lives in its own route-scoped injector. Root-provided interceptors
   would have made them fight over the same chain.
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
styles travel with a federated component. That is why `styles/_tokens.scss`
exposes **SCSS variables and mixins**, not CSS custom properties: compile-time
values are baked into each component's own styles by that component's own build,
so they survive the crossing. A `var(--token)` defined only in the remote's
`styles.scss` would resolve to nothing inside the shell.

`styles/` is wired into all three projects through
`stylePreprocessorOptions.includePaths`, which makes it **the one intentional
build-time coupling in this workspace**. It carries values, never behaviour, and
it is a deliberate trade: three independently deployed applications that must look
like one product need _some_ shared vocabulary. The alternatives are worse — a
published design-token package (real versioning, real release process, correct at
scale) or per-project copies (zero coupling, guaranteed drift).

The "Rendered by the … remote" strip is duplicated in both remotes on purpose. A
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
| Host entry         | host consumed only                | `hostRemoteEntry: { url: './remoteEntry.json' }` — hosts publish too  |
| Runtime handle     | module-scoped `loadRemoteModule`  | handle returned by `initFederation`; the global helper is deprecated  |
| Shared build       | n/a                               | `build: 'package'`                                                    |
| Chunk metadata     | n/a                               | `features.denseChunking`                                              |
| Unused deps        | `features.ignoreUnusedDeps: true` | on by default; `includeSecondaries` is how you opt out                |
| Orchestrator       | `@softarc/native-federation-node` | `@softarc/native-federation-orchestrator`                             |
| Shims              | `es-module-shims` ^1.x            | ^2.x, now a direct dependency of the plugin                           |

## 10. Trade-offs this baseline accepts

Most of these are inherent to _any_ federation runtime, not to Native Federation.
They are the material for the comparison with the Rspack and Vite builds.

| Topic                        | Position taken here                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Builder ownership**        | Stay on `@angular/build:application`. Upgrades follow Angular's release notes; no bundler stack to own. This is the whole point of the baseline.                                            |
| **Bundler still required**   | The "no bundler" pitch of raw ESM does not apply. Tree-shaking, code splitting, CSS pipelines, TS, source maps and budgets all still live in the bundler.                                   |
| **Cross-origin posture**     | Chunks are fetched cross-origin (`:4201` → `:4200`). The dev server allows it; production needs explicit CORS headers, cache rules and SBOM coverage of every origin.                       |
| **Cross-origin DX cost**     | Source maps and stack traces straddle two origins. Fine for a demo; in many-team setups a unified delivery layer (per-team prefixes on one CDN, or a platform like Zephyr) pays off.        |
| **No unload semantics**      | ESM cannot unload a module. Long-lived multi-remote shells that need memory recovery reach `registerRemotes(..., { force: true })` / `removeRemote()` through classic MF.                   |
| **Single Angular major**     | Layered singletons — the same specifier as _different_ singletons per layer, e.g. two Angular majors side by side — remain a classic-MF capability. Not needed for one major version.       |
| **Loader hooks**             | NF covers retries, fallbacks and telemetry. The broader MF hook surface (`beforeLoadRemote`, `errorLoadRemote`, `afterResolve`) is reachable via the documented combination pattern.        |
| **Shared build-time tokens** | One SCSS file is shared across three builds. Documented above as a deliberate trade rather than an oversight.                                                                               |
| **No e2e**                   | Shell↔remote wiring is only verified manually. The honest gap in the test story.                                                                                                            |
| **Experimental API**         | `debounced()` from `@angular/core` is experimental in v22. Used in both containers because it replaces the RxJS `debounceTime` ceremony; swap for a `FormControl` pipeline if that matters. |

## Further reading

- [Native Federation README](https://github.com/angular-architects/module-federation-plugin/blob/main/libs/native-federation/README.md)
- [Native Federation for Angular 17.1+ (Application Builder)](https://www.angulararchitects.io/en/blog/announcing-native-federation-for-angular-17-1/)
- [Combining Native Federation and Module Federation](https://www.angulararchitects.io/en/blog/combining-native-federation-and-module-federation/)
- [Module Federation vs Native ESM](https://zephyr-cloud.io/blog/module-federation-vs-native-esm) — why a federation _runtime_ is needed even when the _transport_ is plain ESM
- [Angular custom build pipeline](https://angular.dev/ecosystem/custom-build-pipeline) — Angular's own framing of when to leave the default builder
