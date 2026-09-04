import type { Routes } from '@angular/router';

import { federation } from '../../../../federation';
import type { RemoteName } from '../../models/remote.model';
import type { RemoteWidgetResult, RemoteWidgetsModule } from '../../models/remote-widget.model';
import { RemoteUnavailableComponent } from '../../containers/remote-unavailable/remote-unavailable.component';

/** Every remote in this workspace exposes its route table under the same key. */
export const exposedRoutes = './Routes';

/** ...and its mountable widgets under this one. */
export const exposedWidgets = './Widgets';

interface RemoteRoutesModule {
  routes: Routes;
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
    const module = await federation().loadRemoteModule<RemoteRoutesModule>(remote, exposedRoutes);

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
 * that never mounts a widget never pays for its code.
 *
 * `federation()` stays inside the try: it throws synchronously when
 * `initFederation` has not resolved, which is exactly the path a unit test and a
 * cold start take.
 */
export async function loadRemoteWidget(
  remote: RemoteName,
  widgetId: string,
): Promise<RemoteWidgetResult> {
  let module: RemoteWidgetsModule;

  try {
    module = await federation().loadRemoteModule<RemoteWidgetsModule>(remote, exposedWidgets);
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
