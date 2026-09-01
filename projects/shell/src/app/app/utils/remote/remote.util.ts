import type { Routes } from '@angular/router';

import { federation } from '../../../../federation';
import type { RemoteName } from '../../models/remote.model';
import { RemoteUnavailable } from '../../containers/remote-unavailable/remote-unavailable';

/** Every remote in this workspace exposes its route table under the same key. */
export const EXPOSED_ROUTES = './Routes';

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
    const module = await federation().loadRemoteModule<RemoteRoutesModule>(remote, EXPOSED_ROUTES);

    return module.routes;
  } catch (error) {
    console.error(`[shell] could not load remote "${remote}" (${EXPOSED_ROUTES})`, error);

    return remoteUnavailableRoutes(remote);
  }
}

function remoteUnavailableRoutes(remote: RemoteName): Routes {
  return [
    {
      path: '**',
      component: RemoteUnavailable,
      data: { remote },
    },
  ];
}
