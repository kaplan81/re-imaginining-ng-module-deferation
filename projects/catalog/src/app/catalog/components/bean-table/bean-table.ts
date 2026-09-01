import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';

import type { BeanSortFieldET } from '../../enums/bean-sort-field.enum';
import { COFFEE_PROCESS_LABELS } from '../../enums/coffee-process.enum';
import { ROAST_LEVEL_LABELS } from '../../enums/roast-level.enum';
import type { SortDirectionET } from '../../enums/sort-direction.enum';
import type { Bean } from '../../models/bean.model';
import type { BeanSort } from '../../models/catalog-query.model';

interface Column {
  field: BeanSortFieldET;
  label: string;
  numeric: boolean;
}

@Component({
  selector: 'cat-bean-table',
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './bean-table.html',
  styleUrl: './bean-table.scss',
})
export class BeanTable {
  readonly items = input.required<readonly Bean[]>();
  readonly sort = input<BeanSort | null>(null);

  readonly sortChange = output<BeanSort | null>();

  protected readonly columns: readonly Column[] = [
    { field: 'name', label: 'Lot', numeric: false },
    { field: 'origin', label: 'Origin', numeric: false },
    { field: 'roast', label: 'Roast', numeric: false },
    { field: 'score', label: 'Score', numeric: true },
    { field: 'pricePerKg', label: 'Price / kg', numeric: true },
    { field: 'stockKg', label: 'Stock', numeric: true },
  ];

  protected readonly roastLabels = ROAST_LEVEL_LABELS;
  protected readonly processLabels = COFFEE_PROCESS_LABELS;

  protected directionFor(field: BeanSortFieldET): SortDirectionET | null {
    const current = this.sort();

    return current?.field === field ? current.direction : null;
  }

  protected ariaSortFor(field: BeanSortFieldET): 'ascending' | 'descending' | 'none' {
    switch (this.directionFor(field)) {
      case 'asc':
        return 'ascending';
      case 'desc':
        return 'descending';
      default:
        return 'none';
    }
  }

  /** Click cycles ascending → descending → unsorted, so the backend default is reachable. */
  protected onHeaderClick(field: BeanSortFieldET): void {
    switch (this.directionFor(field)) {
      case null:
        this.sortChange.emit({ field, direction: 'asc' });
        return;
      case 'asc':
        this.sortChange.emit({ field, direction: 'desc' });
        return;
      default:
        this.sortChange.emit(null);
    }
  }
}
