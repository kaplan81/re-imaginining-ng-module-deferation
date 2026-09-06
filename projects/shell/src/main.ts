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
 * The Angular adapter already publishes `./remoteEntry.json` as the host entry,
 * so the shell's shared dependencies participate in the same negotiation
 * instead of being a special case.
 *
 * `shimMode: false` installs that map with the browser's native import maps
 * instead of es-module-shims. The federation builder's `esmsInitOptions` must
 * match, or the entry stays `type="module-shim"` while the runtime expects
 * native resolution. Needs Chrome/Edge 133+, Safari 18.4+ or Firefox 150+.
 */
initFederation('federation.manifest.json', { shimMode: false })
  .then((runtime) => {
    setFederation(runtime);
    return import('./bootstrap');
  })
  .catch((err) => console.error(err));
