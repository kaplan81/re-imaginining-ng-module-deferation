# Build 3 — Vite + Module Federation

The same five Roast Republic applications as the Angular CLI baseline, compiled by
**Vite** through `@analogjs/vite-plugin-angular` and composed at runtime by
**classic Module Federation** via `@module-federation/vite`.

The full write-up — version constraints, findings, parity checklist and the
three-way measured comparison — is in
[`docs/PLAN-VITE.md`](../../docs/PLAN-VITE.md). This file is the map.

## Running it

From the workspace root:

```bash
npm run start:vite:all
```

Then open <http://localhost:5173>. Build 3 uses ports **5173–5177**, so all three
pipelines can run at once (4200–4204, 4210–4214, 5173–5177).

```bash
npm run build:vite
npm run preview:vite
```

`vite preview` is the real checkpoint, not `vite dev` — Vite's dev and build paths
differ enough that dev-only success proves little. Every parity item was checked
on the built output.

## Why the feature code is not here

There is no `src/app/<feature>` in any of these projects. The applications are
entry points and build configuration only; every component, service, interceptor,
mock and model is imported straight out of `projects/*` through the `paths`
aliases in `tsconfig.base.json`.

That is the point of the exercise. If the feature code is byte-identical, then
every difference the talk shows is attributable to the pipeline and nothing else.

## What each file is for

| Path                   | What it is                                                                       |
| ---------------------- | -------------------------------------------------------------------------------- |
| `tsconfig.base.json`   | The `paths` aliases that map `@rr/*` onto `projects/*`                           |
| `tools/aliases.ts`     | Derives Vite's `resolve.alias` from those same `paths` — Vite does not read them |
| `tools/shared-deps.ts` | Generates the MF share map from `package.json`, and prunes what nothing imports  |
| `tools/seam.ts`        | Swaps the shell's federation seam in `resolveId`, and asserts it fired           |
| `<app>/vite.config.ts` | `angular()` + `federation()`                                                     |
| `shell/src/main.ts`    | Fetches `federation.manifest.json` and registers remotes at runtime              |
| `shell/src/seam/*.ts`  | The only two shell modules this pipeline replaces                                |
| `shell/public/*.json`  | The two config assets — same schema as build 1                                   |

## The seam

Four of the five applications compile from `projects/*` completely unmodified.
The shell is the exception, because it is the only one that _calls_ a federation
runtime. Two modules are substituted at bundle time:

- `remote.util.ts` — the loader for `./Routes` and `./Widgets`
- `remote-registry.service.ts` — `mf-manifest.json` spells `exposes[].key` as
  `exposes[].path`

Everything else under `projects/shell/src` compiles byte for byte from build 1.

`remote.util.ts` here is a character-for-character copy of build 2's apart from
the import specifier. That is the finding, not an accident: swapping the
**bundler** did not touch it; swapping the **federation runtime** is what rewrote
it.

`tools/seam.ts` fails the build two ways — `existsSync` on both configured paths,
and an assertion that every replacement actually fired. Both guards exist because
the first version silently shipped build 1's Native Federation calls in a green
build.

## Gotchas worth knowing before you touch a config

Each has a comment at the site that needs it; all are in
[`docs/PLAN-VITE.md` §4](../../docs/PLAN-VITE.md).

1. **`tsconfig` and `inlineStylesExtension: 'scss'` on `angular()`** — Analog
   defaults to `tsconfig.app.json` and warns-then-continues without it, silently
   dropping `strictTemplates`. Without the SCSS setting, component `styles:`
   blocks are parsed as CSS and the page renders unstyled.
2. **`resolve.alias`** — Vite does not read tsconfig `paths`.
3. **Prune the share map** — `@module-federation/vite` emits a fallback chunk per
   _declared_ share, not per _used_ one. Sharing all of `dependencies` put 607 kB
   of `@angular/compiler` in every app.
4. **`hostInitInjectLocation: 'entry'`** on the host — the default preloads every
   shared package from `index.html`.
5. **`optimizeDeps.include`** — otherwise Vite discovers Angular's secondary entry
   points mid-load and forces a reload that races the in-flight graph.
6. **`server.origin` / `base`** — a remote's chunks must be fetched from the
   remote, not from whoever mounted it.
7. **`build.target: 'es2022'`** — MF's runtime uses top-level `await`.
8. **`liveReload: true`** — otherwise every save is a full page reload.
