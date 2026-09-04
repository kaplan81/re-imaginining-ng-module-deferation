import type { RoastLevelET } from '../enums/roast-level.enum';

/**
 * Narrower than the catalog's `Bean` on purpose: this application only ever
 * renders a ranked shortlist, so it models what it shows and nothing else.
 */
export interface Lot {
  id: string;
  name: string;
  origin: string;
  roast: RoastLevelET;
  score: number;
}

export interface LotPage {
  items: readonly Lot[];
  /** Size of the whole ranked set, not of `items` - the widget reports "top N of T". */
  total: number;
}
