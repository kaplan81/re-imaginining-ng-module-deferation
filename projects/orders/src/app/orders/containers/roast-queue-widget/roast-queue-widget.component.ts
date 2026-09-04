import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { RemoteOriginComponent } from '../../components/remote-origin/remote-origin.component';
import { orderStatusLabels } from '../../enums/order-status.enum';
import type { OrderSort } from '../../models/orders-query.model';
import { OrdersService } from '../../services/orders/orders.service';

const widgetPageSize = 5;
const dueSoonestSort: OrderSort = { field: 'dueAt', direction: 'asc' };

/**
 * The orders remote's contribution to a page it does not own. See the note on
 * `TopLotsWidgetComponent` for the two rules a widget follows (no
 * `ActivatedRoute`, no `<h1>`).
 *
 * This deliberately does *not* filter to open statuses only. `OrdersQuery`
 * carries a single `status`, not a set, and `openStatuses` is applied
 * client-side elsewhere; adding a multi-status parameter would widen this
 * remote's own backend contract, which is a bigger decision than a widget should
 * make on its own. The five soonest-due orders plus the backend's `summary` -
 * which is computed over the whole result set, not the page - answer the
 * question without it.
 */
@Component({
  selector: 'ord-roast-queue-widget',
  imports: [DecimalPipe, RemoteOriginComponent],
  templateUrl: './roast-queue-widget.component.html',
  styleUrl: './roast-queue-widget.component.scss',
})
export class RoastQueueWidgetComponent {
  #orders = inject(OrdersService);

  statusLabels = orderStatusLabels;

  pageResource = resource({
    loader: () =>
      firstValueFrom(
        this.#orders.search({ page: 1, pageSize: widgetPageSize, sort: dueSoonestSort }),
      ),
  });

  orders = computed(() => this.pageResource.value()?.items ?? []);
  summary = computed(() => this.pageResource.value()?.summary);

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
