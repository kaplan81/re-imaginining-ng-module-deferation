import { initFederation } from '@angular-architects/native-federation';

/** See the note in the catalog remote's `main.ts`. */
initFederation({}, { shimMode: false })
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));
