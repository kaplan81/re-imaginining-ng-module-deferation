import { Component, inject } from '@angular/core';

import { RemoteSlotComponent } from '../../../app/containers/remote-slot/remote-slot.component';
import { RemoteRegistryService } from '../../../app/services/remote-registry/remote-registry.service';
import { RemoteStatusComponent } from '../../components/remote-status/remote-status.component';

@Component({
  selector: 'shl-home',
  imports: [RemoteSlotComponent, RemoteStatusComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  #registry = inject(RemoteRegistryService);

  /**
   * Which widget microfrontends to mount, and where, read from
   * `widget-slots.json` rather than written into this template. Adding one is a
   * JSON edit and a deploy - the shell is not rebuilt and this file does not
   * change.
   */
  slots = this.#registry.slots;

  steps = [
    {
      order: '01',
      title: 'Manifest',
      body: 'The shell reads federation.manifest.json and learns where each remote lives. Nothing is compiled in.',
    },
    {
      order: '02',
      title: 'Negotiate',
      body: 'Every remoteEntry.json declares its shared packages. The runtime picks one @angular/core for the page.',
    },
    {
      order: '03',
      title: 'Import map',
      body: 'The agreed versions land in an import map, so bare specifiers resolve identically in shell and remotes.',
    },
    {
      order: '04',
      title: 'Compose',
      body: 'A page remote hands over a URL subtree; a widget microfrontend hands over one component, mounted here.',
    },
  ];
}
