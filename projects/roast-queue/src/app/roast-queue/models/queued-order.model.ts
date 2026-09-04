import type { OrderStatusET } from '../enums/order-status.enum';

/**
 * Narrower than the orders application's `Order` on purpose: this microfrontend
 * renders a due-date queue, so it models what it shows and nothing else.
 */
export interface QueuedOrder {
  id: string;
  reference: string;
  customer: string;
  status: OrderStatusET;
  quantityKg: number;
  dueAt: string;
  /** Negative when already late; relative to the backend's fixed "today". */
  daysToDue: number;
}

export interface QueuePage {
  items: readonly QueuedOrder[];
  /** Whole open queue, not just `items` - the widget reports totals over everything. */
  openOrders: number;
  lateOrders: number;
  kgQueued: number;
}
