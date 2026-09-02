import { Component, input, model, output } from '@angular/core';

import { roastLevelLabels, roastLevels, type RoastLevelET } from '../../enums/roast-level.enum';

export type CatalogLayout = 'grid' | 'table';

@Component({
  selector: 'cat-catalog-toolbar',
  templateUrl: './catalog-toolbar.component.html',
  styleUrl: './catalog-toolbar.component.scss',
})
export class CatalogToolbarComponent {
  origins = input.required<readonly string[]>();

  search = model.required<string>();
  roast = model.required<RoastLevelET | ''>();
  origin = model.required<string>();
  layout = model.required<CatalogLayout>();

  reset = output<void>();

  roastLevels = roastLevels;
  roastLabels = roastLevelLabels;

  onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onRoastChange(event: Event): void {
    this.roast.set((event.target as HTMLSelectElement).value as RoastLevelET | '');
  }

  onOriginChange(event: Event): void {
    this.origin.set((event.target as HTMLSelectElement).value);
  }
}
