import type { OrderStatusET } from '../enums/order-status.enum';

/** A wholesale roast order as the fulfilment backend reports it. */
export interface Order {
  id: string;
  reference: string;
  customer: string;
  city: string;
  blend: string;
  status: OrderStatusET;
  quantityKg: number;
  totalEur: number;
  placedAt: string;
  dueAt: string;
  /** Negative when the order is already late; relative to the backend's "today". */
  daysToDue: number;
}

export interface OrderPage {
  items: readonly Order[];
  total: number;
  page: number;
  pageSize: number;
  summary: OrderSummary;
}

/**
 * Aggregates computed by the backend over the *whole* result set, not just the
 * current page - a UI that sums the visible rows would report the wrong numbers
 * as soon as paging is server-driven.
 */
export interface OrderSummary {
  openOrders: number;
  kgInRoasting: number;
  lateOrders: number;
  revenueEur: number;
  byStatus: Readonly<Record<OrderStatusET, number>>;
}
