import { TestBed } from '@angular/core/testing';

import { remotes } from '../../models/remote.model';
import { RemoteRegistryService } from './remote-registry.service';

const manifest = {
  catalog: 'http://localhost:4201/remoteEntry.json',
  orders: 'http://localhost:4202/remoteEntry.json',
};

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
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

  it('should start with every declared remote in the checking state', () => {
    expect(registry.statuses().map((status) => status.name)).toEqual(
      remotes.map((remote) => remote.name),
    );
    expect(registry.statuses().every((status) => status.health === 'checking')).toBe(true);
  });

  it('should mark remotes online and read their exposed keys from the remote entry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('federation.manifest.json')
          ? jsonResponse(manifest)
          : jsonResponse({
              name: 'whatever',
              exposes: [{ key: './Routes' }],
              shared: [{}, {}, {}],
            }),
      ),
    );

    await registry.refresh();

    for (const status of registry.statuses()) {
      expect(status.health).toBe('online');
      expect(status.exposed).toEqual(['./Routes']);
      expect(status.sharedCount).toBe(3);
      expect(status.remoteEntryUrl).toBe(manifest[status.name]);
    }
  });

  it('should mark a remote offline when its entry cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('federation.manifest.json')) {
          return jsonResponse(manifest);
        }

        if (url.includes('4201')) {
          throw new Error('connection refused');
        }

        return jsonResponse({ name: 'orders', exposes: [{ key: './Routes' }], shared: [] });
      }),
    );

    await registry.refresh();

    const [catalog, orders] = registry.statuses();

    expect(catalog.health).toBe('offline');
    expect(catalog.exposed).toEqual([]);
    expect(orders.health).toBe('online');
  });

  it('should mark remotes offline when the manifest itself is unreadable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 }) as Response),
    );

    await registry.refresh();

    expect(registry.statuses().every((status) => status.health === 'offline')).toBe(true);
    expect(registry.statuses().every((status) => status.remoteEntryUrl === null)).toBe(true);
  });
});
