import type { CoffeeProcessET } from '../enums/coffee-process.enum';
import type { RoastLevelET } from '../enums/roast-level.enum';

/** A green-coffee lot as the catalog backend reports it. */
export interface Bean {
  id: string;
  name: string;
  origin: string;
  region: string;
  roast: RoastLevelET;
  process: CoffeeProcessET;
  tastingNotes: readonly string[];
  score: number;
  pricePerKg: number;
  stockKg: number;
  harvestYear: number;
}

/**
 * Server-driven page. Facets travel with the page so the filter options come
 * from the backend rather than being hard-coded in the UI.
 */
export interface BeanPage {
  items: readonly Bean[];
  total: number;
  page: number;
  pageSize: number;
  facets: BeanFacets;
}

export interface BeanFacets {
  origins: readonly string[];
  totalStockKg: number;
  averageScore: number;
}
