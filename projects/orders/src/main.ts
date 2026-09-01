import { initFederation } from '@angular-architects/native-federation';

/** See the note in the catalog remote's `main.ts`. */
initFederation(
  {},
  {
    hostRemoteEntry: { url: './remoteEntry.json' },
  },
)
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));
