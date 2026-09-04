import { TestBed } from '@angular/core/testing';

import { remotes } from '../../models/remote.model';
import { RemoteRegistryService } from './remote-registry.service';

const manifest: Record<string, string> = {
  catalog: 'http://localhost:4201/remoteEntry.json',
  orders: 'http://localhost:4202/remoteEntry.json',
  'top-lots': 'http://localhost:4203/remoteEntry.json',
};

/** What `widget-slots.json` serves: widget microfrontends the shell was never compiled against. */
const widgetSlots = {
  remotes: [
    {
      name: 'top-lots',
      kind: 'widget',
      label: 'Top scoring lots',
      tagline: 'No pages, one widget.',
      owner: 'Sourcing team',
    },
  ],
  slots: [{ remote: 'top-lots', widget: 'top-lots', heading: 'From the sourcing team' }],
};

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function stubFetch(handler: (url: string) => Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn(handler));
}

function routeAssets(url: string, entry: unknown): Response | null {
  if (url.includes('federation.manifest.json')) {
    return jsonResponse(manifest);
  }

  if (url.includes('widget-slots.json')) {
    return jsonResponse(widgetSlots);
  }

  return entry === undefined ? null : jsonResponse(entry);
}

describe('RemoteRegistryService', () => {
  let registry: RemoteRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    registry = TestBed.inject(RemoteRegistryService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should start with every compiled page remote in the checking state', () => {
    expect(registry.statuses().map((status) => status.name)).toEqual(
      remotes.map((remote) => remote.name),
    );
    expect(registry.statuses().every((status) => status.health === 'checking')).toBe(true);
  });

  it('should mark remotes online and read their exposed keys from the remote entry', async () => {
    stubFetch(async (url) =>
      routeAssets(url, { name: 'whatever', exposes: [{ key: './Routes' }], shared: [{}, {}, {}] })!,
    );

    await registry.refresh();

    for (const status of registry.statuses()) {
      expect(status.health).toBe('online');
      expect(status.exposed).toEqual(['./Routes']);
      expect(status.sharedCount).toBe(3);
      expect(status.remoteEntryUrl).toBe(manifest[status.name]);
    }
  });

  // The point of the two-asset split: a widget microfrontend the shell has no
  // compiled record of still shows up in the topology and still gets a slot.
  it('should pick up widget microfrontends declared only in widget-slots.json', async () => {
    stubFetch(async (url) =>
      routeAssets(url, { name: 'top-lots', exposes: [{ key: './Widgets' }], shared: [{}] })!,
    );

    await registry.refresh();

    const names = registry.statuses().map((status) => status.name);

    expect(names).toContain('top-lots');
    expect(registry.widgetRemotes().map((remote) => remote.name)).toEqual(['top-lots']);
    expect(registry.pageRemotes().map((remote) => remote.name)).toEqual(['catalog', 'orders']);
    expect(registry.slots()).toEqual(widgetSlots.slots);
  });

  it('should mark a remote offline when its entry cannot be fetched', async () => {
    stubFetch(async (url) => {
      const asset = routeAssets(url, undefined);

      if (asset) {
        return asset;
      }

      if (url.includes('4201')) {
        throw new Error('connection refused');
      }

      return jsonResponse({ name: 'other', exposes: [{ key: './Routes' }], shared: [] });
    });

    await registry.refresh();

    const catalog = registry.statuses().find((status) => status.name === 'catalog');
    const orders = registry.statuses().find((status) => status.name === 'orders');

    expect(catalog?.health).toBe('offline');
    expect(catalog?.exposed).toEqual([]);
    expect(orders?.health).toBe('online');
  });

  it('should mark remotes offline when the manifest itself is unreadable', async () => {
    stubFetch(async () => ({ ok: false, status: 404 }) as Response);

    await registry.refresh();

    expect(registry.statuses().every((status) => status.health === 'offline')).toBe(true);
    expect(registry.statuses().every((status) => status.remoteEntryUrl === null)).toBe(true);
  });
});
