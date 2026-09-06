import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from '@rr/orders-app/app.config';
import { App } from '@rr/orders-app/containers/app/app';

import './styles.scss';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
