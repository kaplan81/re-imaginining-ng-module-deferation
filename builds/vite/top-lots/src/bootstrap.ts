import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from '@rr/top-lots-app/app.config';
import { App } from '@rr/top-lots-app/containers/app/app';

import './styles.scss';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
