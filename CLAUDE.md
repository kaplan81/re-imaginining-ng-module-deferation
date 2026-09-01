You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

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
  only contract is the exposed `./Routes` key plus the URL in
  `projects/shell/public/federation.manifest.json`.
- **Never add `provideHttpClient` to a shell `ApplicationConfig`.** Remotes provide
  their own HTTP stack in their route providers so their interceptors cannot leak
  into each other or into the host. The shell uses `fetch` when it needs the
  network.
- **Feature services use `@Service({ autoProvided: false })`** and are listed in
  route providers. Root-provided singletons land in whichever injector is around —
  the shell's, in federated mode.
- **Component styles must be self-sufficient.** A remote's `styles.scss` is not
  loaded by the shell. Use the compile-time SCSS tokens in `styles/_tokens.scss`
  (`@use 'tokens' as t;`), never a CSS custom property defined in a global sheet.
- **Do not extract a shared UI library** between the three applications. The
  duplicated `remote-origin` component is intentional.
- **Mocks stay deterministic.** Seeds are generated from fixed indices, and
  `orders` computes dates against `REFERENCE_TODAY`, not `Date.now()`.

### Layout conventions inside a feature folder

`components/` (presentational) · `containers/` (stateful, route entry) ·
`services/` · `models/` · `enums/` · `interceptors/` · `mocks/`. Enums follow the
`enum X {...}` + `type XET = keyof typeof X` pattern. File names carry no
`.component` / `.service` suffix (Angular v22 style guide).

### After changing federation wiring

Rebuild the affected project and confirm `dist/<project>/browser/remoteEntry.json`
still lists the expected `exposes` keys. `tsconfig.federation.json` must name the
exposed entry points — it is what the federation build compiles, separately from
`tsconfig.app.json`.
