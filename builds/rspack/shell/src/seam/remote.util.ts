import type { Routes } from '@angular/router';
import { loadRemote } from '@module-federation/enhanced/runtime';

import type { RemoteName } from '@rr/shell/models/remote.model';
import type { RemoteWidgetResult, RemoteWidgetsModule } from '@rr/shell/models/remote-widget.model';
import { RemoteUnavailableComponent } from '@rr/shell/containers/remote-unavailable/remote-unavailable.component';

/**
 * Build 2's federation seam. This module is substituted for
 * `projects/shell/src/app/app/utils/remote/remote.util.ts` by the bundler - see
 * `tools/seam.ts` - so every other file in the shell compiles unmodified and
 * still calls `loadRemoteRoutes` / `loadRemoteWidget` by the same names, with
 * the same signatures and the same failure semantics.
 *
 * Line for line this is the baseline with two substitutions:
 *
 *   federation().loadRemoteModule(remote, './Routes')  ->  loadRemote('remote/Routes')
 *
 * and the disappearance of `federation.ts`. Native Federation returns a runtime
 * handle from `initFederation`, which the baseline stores so that nothing can
 * load a remote before shared dependencies are negotiated. Module Federation has
 * no such handle: `loadRemote` is a free function reading a global instance the
 * plugin installed. That is more convenient and strictly weaker - the "not
 * ready yet" case that the baseline turns into a synchronous throw is, here,
 * just a rejected promise that looks exactly like an unreachable remote.
 *
 * Note the key concatenation. `loadRemote` takes one string, `'catalog/Routes'`,
 * where the baseline takes a remote and an exposed key as separate arguments.
 * The exposed key is therefore spelled `Routes`, not `./Routes`, in the request
 * - even though `mf-manifest.json` records it as `./Routes`. The stray `./` is
 * an easy and completely silent typo, so it is written once, here.
 */

/** Every page remote in this workspace exposes its route table under this key. */
export const exposedRoutes = './Routes';

/** ...and every widget microfrontend its mountable widgets under this one. */
export const exposedWidgets = './Widgets';

interface RemoteRoutesModule {
  routes: Routes;
}

/** `loadRemote` wants `catalog/Routes`; the manifest records `./Routes`. */
function requestFor(remote: RemoteName, exposed: string): string {
  return `${remote}/${exposed.replace(/^\.\//, '')}`;
}

/**
 * Loads a remote's exposed route table, degrading to an in-shell explanation
 * when the remote cannot be reached.
 *
 * The shell is composed at runtime, so a remote being down is a normal operating
 * condition rather than a build error. Swallowing it here keeps navigation and
 * the rest of the shell alive; the alternative - letting the rejection escape -
 * leaves the router on the previous URL with no feedback.
 */
export async function loadRemoteRoutes(remote: RemoteName): Promise<Routes> {
  try {
    const module = await loadRemote<RemoteRoutesModule>(requestFor(remote, exposedRoutes));

    // `loadRemote` resolves to `null` rather than rejecting when the remote is
    // registered but the key is missing - a case Native Federation reports as a
    // rejection. Collapsing it into the same branch keeps the two pipelines
    // behaving identically from the router's point of view.
    if (!module) {
      throw new Error(`remote "${remote}" resolved no module for "${exposedRoutes}"`);
    }

    return module.routes;
  } catch (error) {
    console.error(`[shell] could not load remote "${remote}" (${exposedRoutes})`, error);

    return remoteUnavailableRoutes(remote);
  }
}

/**
 * Resolves one widget from a remote's `./Widgets` list.
 *
 * Two lazy levels happen here, and only the first is federation's: loading the
 * key fetches the remote's descriptor list, and the descriptor's own `load()` is
 * a dynamic import inside the remote that fetches the component chunk. A host
 * that never mounts a widget never pays for its code. Both levels survive the
 * pipeline change unchanged, because the descriptor in `<remote>.widgets.ts` is
 * plain `@angular/core` and contains no federation API at all.
 */
export async function loadRemoteWidget(
  remote: RemoteName,
  widgetId: string,
): Promise<RemoteWidgetResult> {
  let module: RemoteWidgetsModule;

  try {
    const loaded = await loadRemote<RemoteWidgetsModule>(requestFor(remote, exposedWidgets));

    if (!loaded) {
      throw new Error(`remote "${remote}" resolved no module for "${exposedWidgets}"`);
    }

    module = loaded;
  } catch (error) {
    console.error(`[shell] could not load remote "${remote}" (${exposedWidgets})`, error);

    return { status: 'unreachable' };
  }

  const descriptor = module.widgets.find((candidate) => candidate.id === widgetId);

  if (!descriptor) {
    const available = module.widgets.map((candidate) => candidate.id);

    console.error(
      `[shell] remote "${remote}" publishes no widget "${widgetId}" (has: ${available.join(', ') || 'none'})`,
    );

    return { status: 'not-found', available };
  }

  try {
    return { status: 'ready', widget: await descriptor.load() };
  } catch (error) {
    console.error(`[shell] widget "${remote}/${widgetId}" failed to load its component`, error);

    return { status: 'unreachable' };
  }
}

function remoteUnavailableRoutes(remote: RemoteName): Routes {
  return [
    {
      path: '**',
      component: RemoteUnavailableComponent,
      data: { remote },
    },
  ];
}
