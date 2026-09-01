import { initFederation } from '@angular-architects/native-federation';

import { setFederation } from './federation';

/**
 * The shell boots in two phases.
 *
 * 1. `initFederation` reads `federation.manifest.json`, fetches every remote's
 *    `remoteEntry.json`, negotiates shared dependency versions and installs the
 *    resulting import map.
 * 2. Only then is the Angular application imported, so shell and remotes resolve
 *    the very same `@angular/core` instance rather than two copies of it.
 *
 * `hostRemoteEntry` makes the shell publish its own `remoteEntry.json` as well,
 * so its shared dependencies participate in the same negotiation instead of
 * being a special case.
 */
initFederation('federation.manifest.json', {
  hostRemoteEntry: { url: './remoteEntry.json' },
})
  .then((runtime) => {
    setFederation(runtime);
    return import('./bootstrap');
  })
  .catch((err) => console.error(err));
