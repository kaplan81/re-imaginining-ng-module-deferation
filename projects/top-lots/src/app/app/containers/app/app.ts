import { Component } from '@angular/core';

import { WidgetGalleryComponent } from '../widget-gallery/widget-gallery.component';

/**
 * Only used when this microfrontend runs on its own. There is no router: the
 * application has no routes, so the wrapper renders the gallery directly. The
 * frame it draws is deliberately not part of anything exposed - a host mounts a
 * widget, never this wrapper, so the two layouts can never nest.
 */
@Component({
  selector: 'tlo-root',
  imports: [WidgetGalleryComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
