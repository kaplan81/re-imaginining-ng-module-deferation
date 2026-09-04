import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { RemoteOriginComponent } from '../../components/remote-origin/remote-origin.component';
import { orderStatusLabels } from '../../enums/order-status.enum';
import { RoastQueueService } from '../../services/roast-queue/roast-queue.service';

const widgetLimit = 5;

/**
 * Mounted by a host into a page the host owns, never navigated to. See the note
 * on this workspace's other widget: no `ActivatedRoute`, no `<h1>`, and
 * component styles carry their own tokens because this application's
 * `styles.scss` is not loaded in the host's document.
 */
@Component({
  selector: 'rqu-roast-queue-widget',
  imports: [DecimalPipe, RemoteOriginComponent],
  templateUrl: './roast-queue-widget.component.html',
  styleUrl: './roast-queue-widget.component.scss',
})
export class RoastQueueWidgetComponent {
  #queue = inject(RoastQueueService);

  statusLabels = orderStatusLabels;

  pageResource = resource({
    loader: () => firstValueFrom(this.#queue.queue(widgetLimit)),
  });

  orders = computed(() => this.pageResource.value()?.items ?? []);
  totals = computed(() => this.pageResource.value());

  dueLabel(daysToDue: number): string {
    if (daysToDue < 0) {
      return `${Math.abs(daysToDue)}d late`;
    }

    return daysToDue === 0 ? 'due today' : `in ${daysToDue}d`;
  }

  onReload(): void {
    this.pageResource.reload();
  }
}
