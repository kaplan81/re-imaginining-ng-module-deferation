import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { RemoteOriginComponent } from '../../components/remote-origin/remote-origin.component';
import { roastLevelLabels } from '../../enums/roast-level.enum';
import type { BeanSort } from '../../models/catalog-query.model';
import { CatalogService } from '../../services/catalog/catalog.service';

const widgetPageSize = 5;
const topScoreSort: BeanSort = { field: 'score', direction: 'desc' };

/**
 * The catalog remote's contribution to a page it does not own.
 *
 * Unlike `CatalogViewComponent` this is mounted by whoever holds the descriptor
 * in `catalog.widgets.ts` - the shell, into a slot on its own overview page, or
 * the catalog's standalone gallery on :4201. Two rules follow from that:
 *
 * - No `ActivatedRoute`. A widget is not a route, so there is no route context
 *   to read. `Router` would be fine (it is a shared singleton) but nothing here
 *   needs it.
 * - No `<h1>`. The heading level belongs to the host page; this renders an `h3`
 *   under whatever heading the slot supplies.
 *
 * The query is fixed, so `resource` gets no `params` and the loader runs once.
 */
@Component({
  selector: 'cat-top-lots-widget',
  imports: [DecimalPipe, RemoteOriginComponent],
  templateUrl: './top-lots-widget.component.html',
  styleUrl: './top-lots-widget.component.scss',
})
export class TopLotsWidgetComponent {
  #catalog = inject(CatalogService);

  roastLabels = roastLevelLabels;

  pageResource = resource({
    loader: () =>
      firstValueFrom(
        this.#catalog.search({ page: 1, pageSize: widgetPageSize, sort: topScoreSort }),
      ),
  });

  lots = computed(() => this.pageResource.value()?.items ?? []);
  total = computed(() => this.pageResource.value()?.total ?? 0);

  onReload(): void {
    this.pageResource.reload();
  }
}
