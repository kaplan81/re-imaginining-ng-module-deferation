import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';

import { COFFEE_PROCESS_LABELS } from '../../enums/coffee-process.enum';
import { ROAST_LEVEL_LABELS } from '../../enums/roast-level.enum';
import type { Bean } from '../../models/bean.model';

@Component({
  selector: 'cat-bean-grid',
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './bean-grid.component.html',
  styleUrl: './bean-grid.component.scss',
})
export class BeanGridComponent {
  items = input.required<readonly Bean[]>();

  roastLabels = ROAST_LEVEL_LABELS;
  processLabels = COFFEE_PROCESS_LABELS;

  stockState(bean: Bean): 'low' | 'ok' | 'high' {
    if (bean.stockKg < 60) {
      return 'low';
    }

    return bean.stockKg > 180 ? 'high' : 'ok';
  }
}
