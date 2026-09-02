import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { REMOTES, type RemoteName } from '../../models/remote.model';

const PORTS: Record<RemoteName, number> = {
  catalog: 4201,
  orders: 4202,
};

/**
 * Rendered in place of a remote whose route table could not be fetched. Lives in
 * the shell because at that point nothing from the remote is available to render.
 */
@Component({
  selector: 'shl-remote-unavailable',
  imports: [RouterLink],
  templateUrl: './remote-unavailable.component.html',
  styleUrl: './remote-unavailable.component.scss',
})
export class RemoteUnavailableComponent {
  #route = inject(ActivatedRoute);

  remote = computed<RemoteName>(
    () => (this.#route.snapshot.data['remote'] as RemoteName | undefined) ?? 'catalog',
  );

  label = computed(
    () => REMOTES.find((remote) => remote.name === this.remote())?.label ?? this.remote(),
  );

  command = computed(() => `npm run start:${this.remote()}`);

  port = computed(() => PORTS[this.remote()]);
}
