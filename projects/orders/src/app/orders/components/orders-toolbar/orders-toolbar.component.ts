import { Component, input, model } from '@angular/core';

import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatusET,
} from '../../enums/order-status.enum';

@Component({
  selector: 'ord-orders-toolbar',
  templateUrl: './orders-toolbar.component.html',
  styleUrl: './orders-toolbar.component.scss',
})
export class OrdersToolbarComponent {
  counts = input.required<Readonly<Record<OrderStatusET, number>>>();
  total = input.required<number>();

  search = model.required<string>();
  status = model.required<OrderStatusET | ''>();

  statuses = ORDER_STATUSES;
  statusLabels = ORDER_STATUS_LABELS;

  onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
}
