import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RemoteRegistryService } from '../../services/remote-registry/remote-registry.service';

@Component({
  selector: 'shl-remote-status',
  imports: [RouterLink],
  templateUrl: './remote-status.component.html',
  styleUrl: './remote-status.component.scss',
})
export class RemoteStatusComponent {
  #registry = inject(RemoteRegistryService);

  statuses = this.#registry.statuses;

  constructor() {
    void this.#registry.refresh();
  }

  onRefresh(): void {
    void this.#registry.refresh();
  }
}
