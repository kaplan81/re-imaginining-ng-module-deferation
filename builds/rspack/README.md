# Build 2 — Rspack + Module Federation

The same five Roast Republic applications as the Angular CLI baseline, compiled by
**Rspack** and composed at runtime by **classic Module Federation** instead of
Native Federation.

The full write-up — version constraints, findings, parity checklist and the
measured comparison against build 1 — is in
[`docs/PLAN-RSBUILD.md`](../../docs/PLAN-RSBUILD.md). This file is the map.

## Running it

From the workspace root:

```bash
npm run start:rspack:all
```

Then open <http://localhost:4210>. Build 2 uses ports **4210–4214** so it can run
side by side with build 1 on 4200–4204.

```bash
npm run build:rspack:all
```

## Why the feature code is not here

There is no `src/app/<feature>` in any of these projects. The applications are
entry points and build configuration only; every component, service, interceptor,
mock and model is imported straight out of `projects/*` through the `paths`
aliases in `tsconfig.base.json`.

That is the point of the exercise. If the feature code is byte-identical, then
every difference the talk shows is attributable to the pipeline and nothing else.
Sharing a source tree like this is exactly the build-time coupling the baseline
forbids _between applications_ — here it runs in the opposite direction, between
_pipelines_, and is deliberate.

## What each file is for

| Path                     | What it is                                                                     |
| ------------------------ | ------------------------------------------------------------------------------ |
| `tsconfig.base.json`     | The `paths` aliases that map `@rr/*` onto `projects/*`                         |
| `tools/shared-deps.ts`   | Generates the MF share map from `package.json` — the answer to `shareAll`      |
| `tools/remote-origin.ts` | Restores `import.meta.url` for the "Rendered by …" strip                       |
| `tools/seam.ts`          | Swaps the shell's federation seam below the import graph, and asserts it fired |
| `<app>/rspack.config.ts` | `createConfig(...)` plus `ModuleFederationPlugin`                              |
| `shell/src/main.ts`      | Fetches `federation.manifest.json` and registers remotes at runtime            |
| `shell/src/seam/*.ts`    | The only two shell modules this pipeline replaces                              |
| `shell/public/*.json`    | The two config assets — same schema as build 1                                 |

## The seam

Four of the five applications compile from `projects/*` completely unmodified.
The shell is the exception, because it is the only one that _calls_ a federation
runtime — and `loadRemote` is not `federation().loadRemoteModule`. Two modules are
substituted at bundle time:

- `remote.util.ts` — the loader for `./Routes` and `./Widgets`
- `remote-registry.service.ts` — `mf-manifest.json` spells `exposes[].key` as
  `exposes[].path`

Everything else under `projects/shell/src` — routes, header, home page, the remote
slot, the fallback — is compiled byte for byte from build 1's tree.

`tools/seam.ts` fails the build if an unreplaced original reaches the bundle. That
guard is not theoretical: the first version of the substitution silently did
nothing and shipped build 1's Native Federation calls inside a green build.

## Gotchas worth knowing before you touch a config

Each has a comment at the site that needs it, and all of them are in
[`docs/PLAN-RSBUILD.md` §3.1 and §3.2](../../docs/PLAN-RSBUILD.md).

Build and dev alike:

1. **`optimization.runtimeChunk: false`** — the adapter defaults to `'single'`,
   which leaves `remoteEntry.js` with no Rspack runtime.
2. **`library: { type: 'module' }`** on remotes, **`remoteType: 'module'`** on the
   host — the adapter emits ESM; MF's default container is a global `var`.
3. **`output.publicPath: 'auto'`** — without it a remote's lazy chunks are fetched
   from the _host's_ origin.
4. **Register remotes lazily and one at a time** — a `mf-manifest.json` entry is
   resolved during registration, and one dead remote otherwise takes the whole
   host down with it.

Points 2 and 4 interact: the lazy entry must state `type: 'module'` explicitly,
because dropping the manifest also drops the field that told the runtime the
container was an ES module.

`rspack serve` only — and `npm run build:rspack:all` stays green without them, which
is what made these expensive to find:

5. **`lazyCompilation: false`** in every config. `@rspack/cli` turns it on by
   default for `rspack serve`, so a remote's `loadComponent()` or widget `load()`
   POSTs its compile-trigger to the _host's_ dev server, which knows nothing about
   that compilation. The import never settles, so the route renders an empty
   outlet — no error, no fallback, and `loadRemoteRoutes`' `try/catch` never runs,
   because a promise that never settles is not a rejection.
6. **`devServer: { hmr: false, liveReload: false }` on every remote.** Otherwise
   the remote's dev client rides inside the container into the host's page and
   full-reloads it forever on a stale compilation hash. Both flags, not one — HMR
   and live reload each compare hashes, and the adapter only omits the client
   entirely when both are off.

**Editing a remote therefore does not refresh the shell.** That is the cost of
point 6; reload the browser by hand. The shell keeps its own dev client, so
editing the shell still hot-updates.
