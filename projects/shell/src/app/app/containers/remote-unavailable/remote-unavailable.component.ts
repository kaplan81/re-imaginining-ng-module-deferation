import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { remotes, type RemoteName } from '../../models/remote.model';

/**
 * Only page remotes can land here - this is a *route* fallback, and only a page
 * remote has a route. So the map covers exactly the entries in `remotes`, and an
 * unknown name degrades to omitting the port rather than guessing.
 */
const ports: Readonly<Record<string, number>> = {
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
    () => remotes.find((remote) => remote.name === this.remote())?.label ?? this.remote(),
  );

  command = computed(() => `npm run start:${this.remote()}`);

  port = computed<number | undefined>(() => ports[this.remote()]);
}
