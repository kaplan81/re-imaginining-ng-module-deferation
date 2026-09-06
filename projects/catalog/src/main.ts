import { initFederation } from '@angular-architects/native-federation';

/**
 * A remote initialises the federation runtime too. Served standalone on :4201 it
 * consumes no remotes (`{}`), but it still publishes its own `remoteEntry.json`
 * so the shared-dependency metadata is identical in both modes - the remote is
 * not a second-class citizen of the federation graph.
 */
initFederation({}, { shimMode: false })
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));
