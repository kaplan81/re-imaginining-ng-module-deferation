import { Service, signal } from '@angular/core';

import {
  remotes,
  type RemoteDescriptor,
  type RemoteName,
  type RemoteStatus,
} from '../../models/remote.model';

const manifestUrl = 'federation.manifest.json';

interface RemoteEntry {
  name?: string;
  exposes?: readonly { key?: string }[];
  shared?: readonly unknown[];
}

/**
 * Reads the same `federation.manifest.json` the federation runtime consumed and
 * probes every `remoteEntry.json` behind it, so the shell can show its own
 * topology instead of only failing at navigation time.
 *
 * Uses `fetch` rather than `HttpClient` on purpose: the shell provides no
 * `HttpClient` at all. Each remote brings its own - see the route-scoped
 * providers in `catalog.routes.ts` / `orders.routes.ts`.
 */
@Service()
export class RemoteRegistryService {
  #statuses = signal<readonly RemoteStatus[]>(remotes.map((remote) => toChecking(remote)));

  statuses = this.#statuses.asReadonly();

  async refresh(): Promise<void> {
    this.#statuses.set(remotes.map((remote) => toChecking(remote)));

    const manifest = await this.#readManifest();
    const probed = await Promise.all(
      remotes.map((remote) => this.#probe(remote, manifest[remote.name] ?? null)),
    );

    this.#statuses.set(probed);
  }

  async #readManifest(): Promise<Partial<Record<RemoteName, string>>> {
    try {
      const response = await fetch(manifestUrl, { cache: 'no-store' });

      if (!response.ok) {
        return {};
      }

      return (await response.json()) as Partial<Record<RemoteName, string>>;
    } catch {
      return {};
    }
  }

  async #probe(remote: RemoteDescriptor, remoteEntryUrl: string | null): Promise<RemoteStatus> {
    if (!remoteEntryUrl) {
      return { ...remote, remoteEntryUrl, health: 'offline', exposed: [], sharedCount: null };
    }

    try {
      const response = await fetch(remoteEntryUrl, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const entry = (await response.json()) as RemoteEntry;

      return {
        ...remote,
        remoteEntryUrl,
        health: 'online',
        exposed: (entry.exposes ?? []).map((exposed) => exposed.key ?? '?'),
        sharedCount: entry.shared?.length ?? null,
      };
    } catch {
      return { ...remote, remoteEntryUrl, health: 'offline', exposed: [], sharedCount: null };
    }
  }
}

function toChecking(remote: RemoteDescriptor): RemoteStatus {
  return { ...remote, remoteEntryUrl: null, health: 'checking', exposed: [], sharedCount: null };
}
