import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

import type { OrderSummary } from '../../models/order.model';

@Component({
  selector: 'ord-order-stats',
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './order-stats.html',
  styleUrl: './order-stats.scss',
})
export class OrderStats {
  readonly summary = input.required<OrderSummary>();

  protected readonly lateShare = computed(() => {
    const { openOrders, lateOrders } = this.summary();

    return openOrders === 0 ? 0 : Math.round((lateOrders / openOrders) * 100);
  });
}
