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
  readonly counts = input.required<Readonly<Record<OrderStatusET, number>>>();
  readonly total = input.required<number>();

  readonly search = model.required<string>();
  readonly status = model.required<OrderStatusET | ''>();

  protected readonly statuses = ORDER_STATUSES;
  protected readonly statusLabels = ORDER_STATUS_LABELS;

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
}
