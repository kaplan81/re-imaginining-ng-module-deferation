export enum BeanSortField {
  name,
  origin,
  roast,
  score,
  pricePerKg,
  stockKg,
}

export type BeanSortFieldET = keyof typeof BeanSortField;
