import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';

import type { OrderSortFieldET } from '../../enums/order-sort-field.enum';
import { ORDER_STATUS_LABELS } from '../../enums/order-status.enum';
import type { SortDirectionET } from '../../enums/sort-direction.enum';
import type { Order } from '../../models/order.model';
import type { OrderSort } from '../../models/orders-query.model';

interface Column {
  field: OrderSortFieldET;
  label: string;
  numeric: boolean;
}

@Component({
  selector: 'ord-order-table',
  imports: [CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './order-table.html',
  styleUrl: './order-table.scss',
})
export class OrderTable {
  readonly items = input.required<readonly Order[]>();
  readonly sort = input<OrderSort | null>(null);

  readonly sortChange = output<OrderSort | null>();

  protected readonly columns: readonly Column[] = [
    { field: 'reference', label: 'Order', numeric: false },
    { field: 'customer', label: 'Customer', numeric: false },
    { field: 'status', label: 'Status', numeric: false },
    { field: 'quantityKg', label: 'Volume', numeric: true },
    { field: 'totalEur', label: 'Value', numeric: true },
    { field: 'dueAt', label: 'Due', numeric: false },
  ];

  protected readonly statusLabels = ORDER_STATUS_LABELS;

  protected directionFor(field: OrderSortFieldET): SortDirectionET | null {
    const current = this.sort();

    return current?.field === field ? current.direction : null;
  }

  protected ariaSortFor(field: OrderSortFieldET): 'ascending' | 'descending' | 'none' {
    switch (this.directionFor(field)) {
      case 'asc':
        return 'ascending';
      case 'desc':
        return 'descending';
      default:
        return 'none';
    }
  }

  protected onHeaderClick(field: OrderSortFieldET): void {
    switch (this.directionFor(field)) {
      case null:
        this.sortChange.emit({ field, direction: 'asc' });
        return;
      case 'asc':
        this.sortChange.emit({ field, direction: 'desc' });
        return;
      default:
        this.sortChange.emit(null);
    }
  }

  protected dueLabel(order: Order): string {
    if (order.daysToDue === 0) {
      return 'due today';
    }

    return order.daysToDue > 0
      ? `in ${order.daysToDue} days`
      : `${Math.abs(order.daysToDue)} days ago`;
  }

  protected isLate(order: Order): boolean {
    return order.daysToDue < 0 && order.status !== 'delivered' && order.status !== 'shipped';
  }
}
