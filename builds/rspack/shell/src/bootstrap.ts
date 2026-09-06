import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from '@rr/shell/app.config';
import { App } from '@rr/shell/containers/app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
