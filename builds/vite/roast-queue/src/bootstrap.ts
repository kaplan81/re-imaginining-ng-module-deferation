import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from '@rr/roast-queue-app/app.config';
import { App } from '@rr/roast-queue-app/containers/app/app';

import './styles.scss';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
