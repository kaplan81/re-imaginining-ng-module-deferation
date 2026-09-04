import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { RemoteOriginComponent } from '../../components/remote-origin/remote-origin.component';
import { roastLevelLabels } from '../../enums/roast-level.enum';
import { TopLotsService } from '../../services/top-lots/top-lots.service';

const widgetLimit = 5;

/**
 * The whole point of this application. It is mounted by a host into a page the
 * host owns, never navigated to, so:
 *
 * - No `ActivatedRoute`. A slot is not a route; there is no route context.
 * - No `<h1>`. The heading level belongs to the host page.
 * - Component styles carry their own tokens, because this application's
 *   `styles.scss` is not loaded in the host's document.
 *
 * The query is fixed, so `resource` gets no `params` and the loader runs once.
 */
@Component({
  selector: 'tlo-top-lots-widget',
  imports: [DecimalPipe, RemoteOriginComponent],
  templateUrl: './top-lots-widget.component.html',
  styleUrl: './top-lots-widget.component.scss',
})
export class TopLotsWidgetComponent {
  #topLots = inject(TopLotsService);

  roastLabels = roastLevelLabels;

  pageResource = resource({
    loader: () => firstValueFrom(this.#topLots.topLots(widgetLimit)),
  });

  lots = computed(() => this.pageResource.value()?.items ?? []);
  total = computed(() => this.pageResource.value()?.total ?? 0);

  onReload(): void {
    this.pageResource.reload();
  }
}
