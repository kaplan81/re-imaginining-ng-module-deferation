import type { NativeFederationResult } from '@angular-architects/native-federation';
import type { Provider, Type } from '@angular/core';

import { setFederation } from '../../../../federation';
import { exposedWidgets, loadRemoteWidget } from './remote.util';

/**
 * Installs a fake federation runtime. The real one is never initialised in a
 * unit test, which is exactly why `federation()` is called inside the try in
 * `loadRemoteWidget` - a cold start and a down remote take the same path.
 */
function stubFederation(loadRemoteModule: (remote: string, key: string) => Promise<unknown>): void {
  setFederation({ loadRemoteModule } as unknown as NativeFederationResult);
}

class FakeWidgetComponent {}

const fakeProviders: Provider[] = [{ provide: 'token', useValue: 1 }];

function widgetsModule(ids: readonly string[]) {
  return {
    widgets: ids.map((id) => ({
      id,
      label: `Label for ${id}`,
      load: () =>
        Promise.resolve({
          component: FakeWidgetComponent as Type<unknown>,
          providers: fakeProviders,
        }),
    })),
  };
}

describe('loadRemoteWidget', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should ask the remote for the documented widgets key', async () => {
    const loadRemoteModule = vi.fn(() => Promise.resolve(widgetsModule(['top-lots'])));
    stubFederation(loadRemoteModule);

    await loadRemoteWidget('catalog', 'top-lots');

    expect(loadRemoteModule).toHaveBeenCalledWith('catalog', exposedWidgets);
    expect(exposedWidgets).toBe('./Widgets');
  });

  it('should report the widget and its providers when the remote publishes it', async () => {
    stubFederation(() => Promise.resolve(widgetsModule(['top-lots'])));

    const result = await loadRemoteWidget('catalog', 'top-lots');

    expect(result.status).toBe('ready');

    if (result.status !== 'ready') {
      throw new Error('expected a ready result');
    }

    expect(result.widget.component).toBe(FakeWidgetComponent);
    expect(result.widget.providers).toBe(fakeProviders);
  });

  it('should report the remote as unreachable when its entry cannot be fetched', async () => {
    stubFederation(() => Promise.reject(new Error('ECONNREFUSED')));

    const result = await loadRemoteWidget('catalog', 'top-lots');

    expect(result.status).toBe('unreachable');
    expect(console.error).toHaveBeenCalled();
  });

  // The distinction that matters: a reachable remote that does not publish the
  // requested id is a version skew or a typo, not an outage, and the two need
  // different fixes.
  it('should distinguish a missing widget from an unreachable remote', async () => {
    stubFederation(() => Promise.resolve(widgetsModule(['roast-queue', 'top-lots'])));

    const result = await loadRemoteWidget('catalog', 'nope');

    expect(result.status).toBe('not-found');

    if (result.status !== 'not-found') {
      throw new Error('expected a not-found result');
    }

    expect(result.available).toEqual(['roast-queue', 'top-lots']);
  });

  it('should report unreachable when the descriptor fails to load its component', async () => {
    stubFederation(() =>
      Promise.resolve({
        widgets: [
          {
            id: 'top-lots',
            label: 'Top scoring lots',
            load: () => Promise.reject(new Error('chunk 404')),
          },
        ],
      }),
    );

    const result = await loadRemoteWidget('catalog', 'top-lots');

    expect(result.status).toBe('unreachable');
  });
});
