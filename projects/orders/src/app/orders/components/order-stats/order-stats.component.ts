import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

import type { OrderSummary } from '../../models/order.model';

@Component({
  selector: 'ord-order-stats',
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './order-stats.component.html',
  styleUrl: './order-stats.component.scss',
})
export class OrderStatsComponent {
  readonly summary = input.required<OrderSummary>();

  protected readonly lateShare = computed(() => {
    const { openOrders, lateOrders } = this.summary();

    return openOrders === 0 ? 0 : Math.round((lateOrders / openOrders) * 100);
  });
}
