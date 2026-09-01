import type { BeanSortFieldET } from '../enums/bean-sort-field.enum';
import type { RoastLevelET } from '../enums/roast-level.enum';
import type { SortDirectionET } from '../enums/sort-direction.enum';

export interface BeanSort {
  field: BeanSortFieldET;
  direction: SortDirectionET;
}

export interface CatalogQuery {
  q?: string;
  roast?: RoastLevelET;
  origin?: string;
  page: number;
  pageSize: number;
  sort?: BeanSort;
}
