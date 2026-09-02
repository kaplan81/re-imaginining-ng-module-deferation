export enum OrderStatus {
  intake,
  roasting,
  packed,
  shipped,
  delivered,
  onHold,
}

export type OrderStatusET = keyof typeof OrderStatus;

export const orderStatuses: readonly OrderStatusET[] = [
  'intake',
  'roasting',
  'packed',
  'shipped',
  'delivered',
  'onHold',
];

export const orderStatusLabels: Readonly<Record<OrderStatusET, string>> = {
  intake: 'Intake',
  roasting: 'Roasting',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  onHold: 'On hold',
};

/** Statuses that still need work from the fulfilment team. */
export const openStatuses: readonly OrderStatusET[] = ['intake', 'roasting', 'packed', 'onHold'];
