import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';

import { COFFEE_PROCESS_LABELS } from '../../enums/coffee-process.enum';
import { ROAST_LEVEL_LABELS } from '../../enums/roast-level.enum';
import type { Bean } from '../../models/bean.model';

@Component({
  selector: 'cat-bean-grid',
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './bean-grid.html',
  styleUrl: './bean-grid.scss',
})
export class BeanGrid {
  readonly items = input.required<readonly Bean[]>();

  protected readonly roastLabels = ROAST_LEVEL_LABELS;
  protected readonly processLabels = COFFEE_PROCESS_LABELS;

  protected stockState(bean: Bean): 'low' | 'ok' | 'high' {
    if (bean.stockKg < 60) {
      return 'low';
    }

    return bean.stockKg > 180 ? 'high' : 'ok';
  }
}
