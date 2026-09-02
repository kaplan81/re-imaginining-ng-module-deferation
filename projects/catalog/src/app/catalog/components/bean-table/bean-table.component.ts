import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';

import type { BeanSortFieldET } from '../../enums/bean-sort-field.enum';
import { coffeeProcessLabels } from '../../enums/coffee-process.enum';
import { roastLevelLabels } from '../../enums/roast-level.enum';
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
  templateUrl: './bean-table.component.html',
  styleUrl: './bean-table.component.scss',
})
export class BeanTableComponent {
  items = input.required<readonly Bean[]>();
  sort = input<BeanSort | null>(null);

  sortChange = output<BeanSort | null>();

  columns: readonly Column[] = [
    { field: 'name', label: 'Lot', numeric: false },
    { field: 'origin', label: 'Origin', numeric: false },
    { field: 'roast', label: 'Roast', numeric: false },
    { field: 'score', label: 'Score', numeric: true },
    { field: 'pricePerKg', label: 'Price / kg', numeric: true },
    { field: 'stockKg', label: 'Stock', numeric: true },
  ];

  roastLabels = roastLevelLabels;
  processLabels = coffeeProcessLabels;

  directionFor(field: BeanSortFieldET): SortDirectionET | null {
    const current = this.sort();

    return current?.field === field ? current.direction : null;
  }

  ariaSortFor(field: BeanSortFieldET): 'ascending' | 'descending' | 'none' {
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
  onHeaderClick(field: BeanSortFieldET): void {
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
