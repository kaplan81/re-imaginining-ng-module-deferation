/**
 * This microfrontend's own status vocabulary, not imported from the orders
 * application - no file here may reference `projects/orders`, not even a type.
 * The two agree by convention; a published contracts package is what would make
 * them agree by construction.
 */
export enum OrderStatus {
  intake,
  roasting,
  packed,
  onHold,
}

export type OrderStatusET = keyof typeof OrderStatus;

export const orderStatusLabels: Readonly<Record<OrderStatusET, string>> = {
  intake: 'Intake',
  roasting: 'Roasting',
  packed: 'Packed',
  onHold: 'On hold',
};
