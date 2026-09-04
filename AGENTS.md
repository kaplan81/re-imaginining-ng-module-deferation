You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

> **This file is the single source of truth for agent instructions here.**
> `.claude/CLAUDE.md` and `.gemini/GEMINI.md` do nothing but `@`-import it, so
> every tool reads the same text. Add or change instructions in this file only —
> never in the importers, and never by copying a section across.
>
> Keep the importers. Claude Code loads `CLAUDE.md` and never `AGENTS.md`, so
> deleting it would leave a session with no project instructions at all.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection

---

## This workspace

Three independently built Angular applications composed at runtime by Angular
Architects Native Federation. See `README.md` and `docs/ARCHITECTURE.md` first.

| Project   | Role   | Port | Prefix | Feature folder                      |
| --------- | ------ | ---- | ------ | ----------------------------------- |
| `shell`   | host   | 4200 | `shl`  | `projects/shell/src/app/{app,home}` |
| `catalog` | remote | 4201 | `cat`  | `projects/catalog/src/app/catalog`  |
| `orders`  | remote | 4202 | `ord`  | `projects/orders/src/app/orders`    |

### Rules that federation makes non-negotiable

- **Never import across projects.** No file under `projects/shell` may import from
  `projects/catalog` or `projects/orders`, or vice versa — not even a type. The
  only contract is the two exposed keys, `./Routes` and `./Widgets`, plus the URL
  in `projects/shell/public/federation.manifest.json`. Where a shape has to be
  known on both sides (the widget descriptor), each side declares its own
  structurally identical interface — see `remote-widget.model.ts` in the shell and
  `<remote>.widgets.ts` in each remote.
- **Never add `provideHttpClient` to a shell `ApplicationConfig`.** Remotes provide
  their own HTTP stack — in route providers for `./Routes`, in the widget
  descriptor's `providers` for `./Widgets` — so their interceptors cannot leak into
  each other or into the host. The shell uses `fetch` when it needs the network.
  Be precise about the risk: `HttpClient`, `HttpHandler` and `HttpBackend` are all
  `providedIn: 'root'` in Angular 22, so `inject(HttpClient)` never fails. What is
  _not_ root-provided is the interceptor chain, which resolves from whichever
  `EnvironmentInjector` created the handler. A shell-level interceptor would
  therefore sit above every remote's traffic, silently. `app.config.spec.ts` is the
  tripwire.
- **Feature services use `@Service({ autoProvided: false })`** and are listed in
  route providers. Root-provided singletons land in whichever injector is around —
  the shell's, in federated mode.
- **Component styles must be self-sufficient.** A remote's `styles.scss` is not
  loaded by the shell. Use the compile-time SCSS tokens in
  `projects/<project>/styles/_tokens.scss` (`@use 'tokens' as t;`), never a CSS
  custom property defined in a global sheet.
- **Every project owns its own `styles/` folder**, and the three copies of
  `_tokens.scss` / `_base.scss` are byte-identical on purpose — no project reads
  a sibling's stylesheet, not even at build time. Edit one and you must edit all
  three; `diff` is the drift check. The header comment in `_tokens.scss` records
  why, and that a published styles library package is the way to scale it.
- **Do not extract a shared UI library** between the three applications. The
  duplicated `remote-origin` component is intentional.
- **Mocks stay deterministic.** Seeds are generated from fixed indices, and
  `orders` computes dates against `referenceToday`, not `Date.now()`. Deterministic
  is not the same as well-distributed: keep an index multiplier coprime with its
  modulus, or the spread collapses. `(i * 13) % 39` yielded three distinct cupping
  scores across 96 lots before it was fixed to `% 37`.
- **A widget must not inject `ActivatedRoute`.** A slot is not a route, so there is
  no route context to read. `Router` is fine — it is a shared singleton. A widget
  descriptor's `providers` must be self-sufficient and never rely on a token the
  host happens to provide.
- **Two AA-constrained tokens.** `$color-ink-subtle` and `$color-accent-catalog`
  are used as small text on light surfaces (the `eyebrow` and `chip` mixins), so
  they are pinned to values that clear 4.5:1 on every surface they touch. Do not
  lighten them back, and do not reach for `opacity` to subdue accent text — it
  drops contrast below AA.

### Layout conventions inside a feature folder

`components/` (presentational) · `containers/` (stateful) · `services/` ·
`models/` · `enums/` · `interceptors/` · `mocks/`. Enums follow the
`enum X {...}` + `type XET = keyof typeof X` pattern.

What makes a container is **holding state and orchestrating** — injecting
services, owning signals, deciding what gets rendered — not being the thing a URL
resolves to. Most containers here happen to be route entries, but that is a
consequence, not the definition: `shell/app/containers/remote-slot/` is a
container that is only ever placed inside another template, and each remote's
`app/containers/widget-gallery/` is one too. Presentational components take
`input()`/`output()`/`model()` and inject nothing.

### Naming: the 2016 style guide, deliberately

This workspace does **not** follow the suffix-less Angular v20+ style guide. Every
file carries its type in the name, and every class repeats it:

| Kind        | File                          | Class / symbol           |
| ----------- | ----------------------------- | ------------------------ |
| Component   | `bean-grid.component.ts`      | `BeanGridComponent`      |
| Directive   | `x.directive.ts`              | `XDirective`             |
| Service     | `catalog.service.ts`          | `CatalogService`         |
| Pipe        | `x.pipe.ts`                   | `XPipe`                  |
| Guard       | `x.guard.ts`                  | `xGuard`                 |
| Resolver    | `x.resolver.ts`               | `xResolver`              |
| Interceptor | `catalog-mock.interceptor.ts` | `catalogMockInterceptor` |

- **Template and style siblings carry the same suffix** —
  `bean-grid.component.html`, `bean-grid.component.scss`.
- **Specs mirror the file they test** — `catalog.service.spec.ts`.
- **Containers are components, so they are suffixed `.component.ts` with a
  `Component` class suffix** — never `.container.ts` / `Container`. The
  `containers/` folder is what marks the stateful, route-entry role; the filename
  does not need to say it twice.
- **The one exception is each project's `app/containers/app/app.ts`** (class
  `App`, with `app.html` / `app.scss`). It stays suffix-free on purpose: it is the
  application wrapper that `bootstrap.ts` mounts, not a feature component, and the
  missing suffix is the signal.
- The workspace-level `schematics` block in `angular.json` encodes all of this
  (`type` + `addTypeToClassName: true`, and `typeSeparator: "."` for the kinds
  that need it), so `ng generate` produces conforming files for every project. Do
  not add per-project `schematics` overrides — they shadow it.
- **No `SCREAMING_SNAKE_CASE`.** Module-level constants are camelCase like
  everything else — `beansSeed`, `defaultPageSize`, `referenceToday`. The single
  exception is an Angular injection token, which stays screaming so a
  `new InjectionToken(...)` reads as the DI key it is:

  ```ts
  export const CATALOG_CONFIG = new InjectionToken<CatalogConfig>('catalog.config');
  ```

### After changing federation wiring

Rebuild the affected project and confirm `dist/<project>/browser/remoteEntry.json`
still lists the expected `exposes` keys — `./Routes` and `./Widgets` for both
remotes, and an empty list for the shell. `tsconfig.federation.json` must name the
exposed entry points — it is what the federation build compiles, separately from
`tsconfig.app.json`.

Adding an exposed key is therefore **two** edits, and forgetting the second fails
at build time rather than obviously:

1. the `exposes` map in `federation.config.mjs` (paths are **workspace-root**-relative)
2. the `files` array in `tsconfig.federation.json` (paths are **project**-relative)

Then **restart the remote's dev server**. A long-running `ng serve` does not pick
up a new `exposes` key: it keeps serving a `remoteEntry.json` without it while
happily serving the new chunk, so the host reports the remote as unreachable for
that key and nothing in the log explains why.
