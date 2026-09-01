export enum OrderSortField {
  reference,
  customer,
  status,
  quantityKg,
  totalEur,
  dueAt,
}

export type OrderSortFieldET = keyof typeof OrderSortField;
