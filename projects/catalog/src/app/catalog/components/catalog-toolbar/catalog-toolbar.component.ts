import { Component, input, model, output } from '@angular/core';

import { ROAST_LEVEL_LABELS, ROAST_LEVELS, type RoastLevelET } from '../../enums/roast-level.enum';

export type CatalogLayout = 'grid' | 'table';

@Component({
  selector: 'cat-catalog-toolbar',
  templateUrl: './catalog-toolbar.component.html',
  styleUrl: './catalog-toolbar.component.scss',
})
export class CatalogToolbarComponent {
  readonly origins = input.required<readonly string[]>();

  readonly search = model.required<string>();
  readonly roast = model.required<RoastLevelET | ''>();
  readonly origin = model.required<string>();
  readonly layout = model.required<CatalogLayout>();

  readonly reset = output<void>();

  protected readonly roastLevels = ROAST_LEVELS;
  protected readonly roastLabels = ROAST_LEVEL_LABELS;

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onRoastChange(event: Event): void {
    this.roast.set((event.target as HTMLSelectElement).value as RoastLevelET | '');
  }

  protected onOriginChange(event: Event): void {
    this.origin.set((event.target as HTMLSelectElement).value);
  }
}
