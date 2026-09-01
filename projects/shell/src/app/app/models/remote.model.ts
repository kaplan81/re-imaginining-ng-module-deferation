/** Remotes the shell knows how to place in its navigation. */
export type RemoteName = 'catalog' | 'orders';

export type RemoteHealth = 'checking' | 'online' | 'offline';

/**
 * What the shell declares about a remote: where it belongs in the navigation and
 * how to describe it. Deliberately no types from the remote itself - the shell
 * has no build-time knowledge of what a bean or an order looks like.
 */
export interface RemoteDescriptor {
  readonly name: RemoteName;
  readonly label: string;
  readonly route: string;
  readonly tagline: string;
  readonly owner: string;
}

/** A descriptor joined with what the manifest and the live probe tell us. */
export interface RemoteStatus extends RemoteDescriptor {
  readonly remoteEntryUrl: string | null;
  readonly health: RemoteHealth;
  readonly exposed: readonly string[];
  readonly sharedCount: number | null;
}

export const REMOTES: readonly RemoteDescriptor[] = [
  {
    name: 'catalog',
    label: 'Bean catalog',
    route: '/catalog',
    tagline: 'Green-coffee lots, roast profiles and stock levels.',
    owner: 'Sourcing team',
  },
  {
    name: 'orders',
    label: 'Roast orders',
    route: '/orders',
    tagline: 'Wholesale roast orders from intake to delivery.',
    owner: 'Fulfilment team',
  },
];
