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
  templateUrl: './remote-unavailable.html',
  styleUrl: './remote-unavailable.scss',
})
export class RemoteUnavailable {
  readonly #route = inject(ActivatedRoute);

  protected readonly remote = computed<RemoteName>(
    () => (this.#route.snapshot.data['remote'] as RemoteName | undefined) ?? 'catalog',
  );

  protected readonly label = computed(
    () => REMOTES.find((remote) => remote.name === this.remote())?.label ?? this.remote(),
  );

  protected readonly command = computed(() => `npm run start:${this.remote()}`);

  protected readonly port = computed(() => PORTS[this.remote()]);
}
