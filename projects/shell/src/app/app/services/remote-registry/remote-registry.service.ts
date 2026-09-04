import { computed, Service, signal } from '@angular/core';

import {
  remotes,
  type RemoteDescriptor,
  type RemoteName,
  type RemoteStatus,
  type WidgetSlot,
  type WidgetSlotsConfig,
} from '../../models/remote.model';

const manifestUrl = 'federation.manifest.json';
const widgetSlotsUrl = 'widget-slots.json';

interface RemoteEntry {
  name?: string;
  exposes?: readonly { key?: string }[];
  shared?: readonly unknown[];
}

/**
 * Reads the same `federation.manifest.json` the federation runtime consumed,
 * joins it with the widget microfrontends declared in `widget-slots.json`, and
 * probes every `remoteEntry.json` behind both, so the shell can show its own
 * topology instead of only failing when something is mounted.
 *
 * Two assets rather than one, because they have different owners.
 * `federation.manifest.json` is consumed by `initFederation` before Angular
 * exists and its schema is fixed at `{ name: url }` - adding fields to it would
 * break the runtime. `widget-slots.json` is the shell's own: it says which widget
 * microfrontends exist, how to describe them and where they go. Adding a widget
 * microfrontend is therefore two JSON edits and a deploy, with no shell rebuild.
 *
 * Uses `fetch` rather than `HttpClient` on purpose: the shell installs no HTTP
 * interceptors of its own. Each remote brings its own stack - route-scoped for a
 * page remote, descriptor-scoped for a widget.
 */
@Service()
export class RemoteRegistryService {
  #statuses = signal<readonly RemoteStatus[]>(remotes.map(toChecking));
  #slots = signal<readonly WidgetSlot[]>([]);

  statuses = this.#statuses.asReadonly();

  /** Where the shell should mount widgets, in declaration order. */
  slots = this.#slots.asReadonly();

  pageRemotes = computed(() => this.statuses().filter((remote) => remote.kind === 'page'));
  widgetRemotes = computed(() => this.statuses().filter((remote) => remote.kind === 'widget'));

  async refresh(): Promise<void> {
    const config = await this.#readWidgetSlots();

    this.#slots.set(config.slots);

    // Page remotes are compiled in (they need routes); widget remotes come from
    // the config asset. Both are probed the same way.
    const declared: readonly RemoteDescriptor[] = [...remotes, ...config.remotes];

    this.#statuses.set(declared.map(toChecking));

    const manifest = await this.#readManifest();
    const probed = await Promise.all(
      declared.map((remote) => this.#probe(remote, manifest[remote.name] ?? null)),
    );

    this.#statuses.set(probed);
  }

  async #readManifest(): Promise<Partial<Record<RemoteName, string>>> {
    return (await readJson<Partial<Record<RemoteName, string>>>(manifestUrl)) ?? {};
  }

  async #readWidgetSlots(): Promise<WidgetSlotsConfig> {
    const config = await readJson<WidgetSlotsConfig>(widgetSlotsUrl);

    return { remotes: config?.remotes ?? [], slots: config?.slots ?? [] };
  }

  async #probe(remote: RemoteDescriptor, remoteEntryUrl: string | null): Promise<RemoteStatus> {
    if (!remoteEntryUrl) {
      return { ...remote, remoteEntryUrl, health: 'offline', exposed: [], sharedCount: null };
    }

    const entry = await readJson<RemoteEntry>(remoteEntryUrl);

    if (!entry) {
      return { ...remote, remoteEntryUrl, health: 'offline', exposed: [], sharedCount: null };
    }

    return {
      ...remote,
      remoteEntryUrl,
      health: 'online',
      exposed: (entry.exposes ?? []).map((exposed) => exposed.key ?? '?'),
      sharedCount: entry.shared?.length ?? null,
    };
  }
}

async function readJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' });

    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

function toChecking(remote: RemoteDescriptor): RemoteStatus {
  return { ...remote, remoteEntryUrl: null, health: 'checking', exposed: [], sharedCount: null };
}
