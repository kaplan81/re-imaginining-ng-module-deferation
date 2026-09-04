/**
 * The name of any remote in the federation graph.
 *
 * Deliberately `string` and not a closed union. It used to be
 * `'catalog' | 'orders'`, which meant the *set* of remotes was compiled into the
 * shell: adding one was a code change and a shell redeploy, however much the
 * manifest looked like data. Widget microfrontends are declared in
 * `widget-slots.json` at runtime, so the type cannot be closed.
 */
export type RemoteName = string;

/**
 * What a remote contributes to the host.
 *
 * - `page` owns a URL subtree and exposes `./Routes`.
 * - `widget` owns no URL at all and exposes only `./Widgets`; the host mounts it
 *   into a slot on a page the host owns.
 */
export type RemoteKind = 'page' | 'widget';

export type RemoteHealth = 'checking' | 'online' | 'offline';

/**
 * What the shell declares about a remote: where it belongs and how to describe
 * it. Deliberately no types from the remote itself - the shell has no build-time
 * knowledge of what a bean or an order looks like.
 */
export interface RemoteDescriptor {
  name: RemoteName;
  kind: RemoteKind;
  label: string;
  tagline: string;
  owner: string;
  /** `page` remotes only - the shell route that loads their `./Routes`. */
  route?: string;
}

/** One widget a widget-remote publishes, and where the shell puts it. */
export interface WidgetSlot {
  remote: RemoteName;
  /** Must match an `id` in the remote's exposed `./Widgets` list. */
  widget: string;
  heading: string;
}

/** Shape of `projects/shell/public/widget-slots.json`. */
export interface WidgetSlotsConfig {
  remotes: readonly RemoteDescriptor[];
  slots: readonly WidgetSlot[];
}

/** A descriptor joined with what the manifest and the live probe tell us. */
export interface RemoteStatus extends RemoteDescriptor {
  remoteEntryUrl: string | null;
  health: RemoteHealth;
  exposed: readonly string[];
  sharedCount: number | null;
}

/**
 * The **page** remotes, compiled in.
 *
 * These stay in code because a navigable remote needs a route, and the router
 * table is compiled: `app.routes.ts` has a `loadChildren` per entry here. Adding
 * a page remote is therefore a shell change no matter how it is declared, so
 * pretending otherwise by moving these to JSON would buy nothing and cost the
 * navigation a round trip before it can render.
 *
 * Widget remotes are the opposite case - they need no route, so they are
 * declared entirely in `widget-slots.json` and need no shell rebuild.
 */
export const remotes: readonly RemoteDescriptor[] = [
  {
    name: 'catalog',
    kind: 'page',
    label: 'Bean catalog',
    route: '/catalog',
    tagline: 'Green-coffee lots, roast profiles and stock levels.',
    owner: 'Sourcing team',
  },
  {
    name: 'orders',
    kind: 'page',
    label: 'Roast orders',
    route: '/orders',
    tagline: 'Wholesale roast orders from intake to delivery.',
    owner: 'Fulfilment team',
  },
];
