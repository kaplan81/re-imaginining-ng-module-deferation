import type { OrderSortFieldET } from '../enums/order-sort-field.enum';
import type { OrderStatusET } from '../enums/order-status.enum';
import type { SortDirectionET } from '../enums/sort-direction.enum';

export interface OrderSort {
  field: OrderSortFieldET;
  direction: SortDirectionET;
}

export interface OrdersQuery {
  q?: string;
  status?: OrderStatusET;
  page: number;
  pageSize: number;
  sort?: OrderSort;
}
