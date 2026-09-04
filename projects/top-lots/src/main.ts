import { initFederation } from '@angular-architects/native-federation';

/**
 * Same two-phase entry point every application in this workspace uses. Served
 * standalone on :4203 this consumes no remotes (`{}`), but it still publishes its
 * own `remoteEntry.json` so its shared-dependency metadata is identical whether it
 * is mounted by a host or opened directly.
 */
initFederation(
  {},
  {
    hostRemoteEntry: { url: './remoteEntry.json' },
  },
)
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));
