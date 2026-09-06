import { registerRemotes } from '@module-federation/runtime';

/**
 * The shell boots in two phases, for the same reason it does in build 1: nothing
 * that imports a shared package may be evaluated until the share scope exists,
 * or shell and remotes end up with two `@angular/core` instances.
 *
 * What is different is where the remote URLs come from.
 *
 * The idiomatic Module Federation setup lists remotes statically in
 * `ModuleFederationPlugin({ remotes: { catalog: 'catalog@http://…' } })`, which
 * compiles every URL into the host bundle. That is a real behavioural regression
 * against the baseline, where `federation.manifest.json` is a deployed *asset*:
 * changing a remote's address, or adding a widget microfrontend, is an edit and
 * a redeploy of one JSON file with no shell rebuild. It is also the failure mode
 * worth putting on a slide - lululemon's production `story-app` has
 * `stage.lululemon.com` compiled into its nested remote registrations, which is
 * what a baked-in URL eventually costs.
 *
 * `registerRemotes` buys the property back. The host's plugin declares no
 * remotes at all; this file fetches the same `federation.manifest.json` the
 * baseline uses, in the same `{ name: url }` schema, and registers them before
 * Angular exists.
 *
 * This is a deliberate deviation from `docs/PLAN-VITE.md`, which sketched the
 * idiomatic `@module-federation/vite` seam instead: static `remotes` in the
 * plugin plus `import('catalog/Routes')` against a hand-written `remotes.d.ts`.
 * That version is prettier and strictly weaker. It compiles every remote URL
 * *and every remote name* into the shell bundle, so `widget-slots.json` would
 * stop being able to introduce a widget microfrontend on its own - which is the
 * one architectural property this workspace exists to demonstrate. The hand-
 * written `.d.ts` also asserts the remote's exports rather than verifying them,
 * so it buys types that can silently be wrong. Runtime registration keeps
 * builds 1, 2 and 3 comparable on the row that matters.
 */
interface FederationManifest {
  [remote: string]: string;
}

async function readManifest(): Promise<FederationManifest> {
  const response = await fetch('federation.manifest.json', { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`federation.manifest.json responded ${response.status}`);
  }

  return (await response.json()) as FederationManifest;
}

/**
 * Registers remotes lazily, one at a time, and never lets a failure reach the
 * caller. Both halves of that sentence are fixes for real regressions, and
 * together they are the sharpest finding of this build.
 *
 * **Lazily.** `federation.manifest.json` points at each remote's
 * `mf-manifest.json`, the same way build 1 points at `remoteEntry.json` - it is
 * the document that describes the remote, and the topology panel reads it. But
 * handing that URL to `registerRemotes` as the `entry` makes Module Federation
 * resolve the manifest *eagerly, during registration*. One unreachable remote
 * then rejects before `import('./bootstrap')` is ever reached: no Angular, no
 * header, no router, a blank page. Stopping the catalog dev server takes the
 * shell and the three healthy remotes down with it - precisely the failure mode
 * runtime composition exists to avoid, and one the baseline does not have.
 *
 * Pointing `entry` at the sibling `remoteEntry.js` instead defers all of it to
 * the first `loadRemote` call, which is where build 1 resolves it too. The
 * rewrite is one line and it is the difference between a shell that degrades to
 * a fallback route and a shell that does not start.
 *
 * **`type: 'module'`.** Dropping the manifest also drops the one field the
 * manifest was carrying that the runtime needs: `remoteEntry.type`. Without it
 * Module Federation assumes the default `var` container and injects
 * `remoteEntry.js` with a classic `<script>`, which fails on an ESM container
 * with `Cannot use 'import.meta' outside a module` - the same error the remotes'
 * `library: { type: 'module' }` was added to fix, reintroduced from the host
 * side. Stating it explicitly here is what makes the lazy form safe. The two
 * fixes are one-liners that undo each other if you only apply one, and neither
 * error message mentions the other.
 *
 * **One at a time.** `registerRemotes` rejects the whole call on the first bad
 * entry, so a batch of four is only as available as its least available member.
 * Registering each on its own keeps the failures independent.
 *
 * What is left is exactly build 1's behaviour: a remote being down is a normal
 * operating condition, and `loadRemoteRoutes` / `loadRemoteWidget` each render
 * their own explanation when something finally asks for it.
 */
function lazyEntry(manifestUrl: string): string {
  return manifestUrl.replace(/mf-manifest\.json$/, 'remoteEntry.js');
}

async function register(manifest: FederationManifest): Promise<void> {
  await Promise.all(
    Object.entries(manifest).map(async ([name, entry]) => {
      try {
        await registerRemotes(
          [{ name, entry: lazyEntry(entry), type: 'module' }],
          // `force` so a re-registration replaces a stale URL rather than being
          // silently ignored.
          { force: true },
        );
      } catch (error) {
        // Deliberately swallowed. The remote is simply unreachable; the slot and
        // the route each render their own explanation when something asks.
        console.error(`[shell] remote "${name}" could not be registered`, error);
      }
    }),
  );
}

async function start(): Promise<void> {
  try {
    await register(await readManifest());
  } catch (error) {
    // Even a missing manifest must not stop the shell. Its own pages - home,
    // header, the topology panel - are worth serving, and the panel is the thing
    // that will say the manifest could not be read.
    console.error('[shell] could not read federation.manifest.json', error);
  }

  await import('./bootstrap');
}

void start();
