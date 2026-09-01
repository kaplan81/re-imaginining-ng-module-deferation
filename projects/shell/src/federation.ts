import type { NativeFederationResult } from '@angular-architects/native-federation';

/**
 * Holds the federation runtime handle produced by `initFederation` in `main.ts`.
 *
 * Native Federation also ships a module-scoped `loadRemoteModule` helper, but it
 * resolves against whichever `initFederation` call ran last, which is brittle in
 * tests and multi-host setups. Keeping the returned handle makes the dependency
 * explicit: nothing in the application can load a remote before the runtime has
 * negotiated shared dependencies and published the import map.
 */
let instance: NativeFederationResult | undefined;

export function setFederation(federation: NativeFederationResult): void {
  instance = federation;
}

export function federation(): NativeFederationResult {
  if (!instance) {
    throw new Error('Federation runtime is not ready: initFederation() has not resolved yet.');
  }

  return instance;
}
