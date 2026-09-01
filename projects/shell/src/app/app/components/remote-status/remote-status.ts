import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RemoteRegistry } from '../../services/remote-registry/remote-registry';

@Component({
  selector: 'shl-remote-status',
  imports: [RouterLink],
  templateUrl: './remote-status.html',
  styleUrl: './remote-status.scss',
})
export class RemoteStatus {
  readonly #registry = inject(RemoteRegistry);

  protected readonly statuses = this.#registry.statuses;

  constructor() {
    void this.#registry.refresh();
  }

  protected onRefresh(): void {
    void this.#registry.refresh();
  }
}
