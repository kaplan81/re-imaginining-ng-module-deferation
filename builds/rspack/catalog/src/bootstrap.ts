import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from '@rr/catalog-app/app.config';
import { App } from '@rr/catalog-app/containers/app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
