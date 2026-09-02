import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';

import { coffeeProcessLabels } from '../../enums/coffee-process.enum';
import { roastLevelLabels } from '../../enums/roast-level.enum';
import type { Bean } from '../../models/bean.model';

@Component({
  selector: 'cat-bean-grid',
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './bean-grid.component.html',
  styleUrl: './bean-grid.component.scss',
})
export class BeanGridComponent {
  items = input.required<readonly Bean[]>();

  roastLabels = roastLevelLabels;
  processLabels = coffeeProcessLabels;

  stockState(bean: Bean): 'low' | 'ok' | 'high' {
    if (bean.stockKg < 60) {
      return 'low';
    }

    return bean.stockKg > 180 ? 'high' : 'ok';
  }
}
