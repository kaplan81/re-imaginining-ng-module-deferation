import type { EnvironmentProviders, Provider, Type } from '@angular/core';

/**
 * The shell's view of a widget a remote publishes under `./Widgets`.
 *
 * Declared here rather than imported, for the same reason `RemoteRoutesModule`
 * is declared inside `remote.util.ts`: importing the remote's own interface
 * would be a build-time dependency between independently deployed applications.
 * Both sides assert the shape and nothing verifies they still agree - the same
 * unverified contract `./Routes` has, one level finer.
 *
 * Note what the shell does *not* decide here: how the component is lazily loaded
 * (the remote's `load` owns that) and what providers surround it (the remote
 * ships them). The shell only instantiates.
 */
export interface RemoteWidget {
  id: string;
  label: string;
  load: () => Promise<LoadedRemoteWidget>;
}

export interface LoadedRemoteWidget {
  component: Type<unknown>;
  /** `provideHttpClient()` returns `EnvironmentProviders`, not `Provider`. */
  providers?: readonly (Provider | EnvironmentProviders)[];
}

/** Shape of the module behind the `./Widgets` key. */
export interface RemoteWidgetsModule {
  widgets: readonly RemoteWidget[];
}

/**
 * Why this is a discriminated union rather than `LoadedRemoteWidget | null`:
 * "the remote is down" and "the remote is up but publishes no widget by that id"
 * are different failures with different fixes - start the dev server, versus fix
 * a typo or a version skew between shell and remote. Collapsing them into one
 * empty value throws that away exactly when it is most needed.
 */
export type RemoteWidgetResult =
  | { status: 'ready'; widget: LoadedRemoteWidget }
  | { status: 'unreachable' }
  | { status: 'not-found'; available: readonly string[] };
