import {
  Component,
  computed,
  debounced,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { BeanGridComponent } from '../../components/bean-grid/bean-grid.component';
import { BeanTableComponent } from '../../components/bean-table/bean-table.component';
import { CatalogPagerComponent } from '../../components/catalog-pager/catalog-pager.component';
import {
  type CatalogLayout,
  CatalogToolbarComponent,
} from '../../components/catalog-toolbar/catalog-toolbar.component';
import { RemoteOriginComponent } from '../../components/remote-origin/remote-origin.component';
import type { RoastLevelET } from '../../enums/roast-level.enum';
import type { BeanPage } from '../../models/bean.model';
import type { BeanSort, CatalogQuery } from '../../models/catalog-query.model';
import { CatalogService } from '../../services/catalog/catalog.service';

const DEFAULT_PAGE_SIZE = 12;
const DEFAULT_SORT: BeanSort = { field: 'score', direction: 'desc' };
const SEARCH_DEBOUNCE_MS = 250;

@Component({
  selector: 'cat-catalog-view',
  imports: [
    DecimalPipe,
    BeanGridComponent,
    BeanTableComponent,
    CatalogPagerComponent,
    CatalogToolbarComponent,
    RemoteOriginComponent,
  ],
  templateUrl: './catalog-view.component.html',
  styleUrl: './catalog-view.component.scss',
})
export class CatalogViewComponent {
  readonly #catalog = inject(CatalogService);

  /** Raw input value; `debounced` is the experimental v22 signal equivalent of `debounceTime`. */
  protected readonly searchInput = signal('');
  readonly #search = debounced(this.searchInput, SEARCH_DEBOUNCE_MS);

  protected readonly roast = signal<RoastLevelET | ''>('');
  protected readonly origin = signal('');
  protected readonly layout = signal<CatalogLayout>('grid');
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly sort = signal<BeanSort | null>(DEFAULT_SORT);

  /**
   * Paging is derived state: any change to the filters, the page size or the sort
   * has to send the user back to page one, while explicit `page.set()` calls from
   * the pager still win until the next filter change.
   */
  protected readonly page = linkedSignal<string, number>({
    source: () =>
      [
        this.#search.value(),
        this.roast(),
        this.origin(),
        this.pageSize(),
        this.sort()?.field ?? '',
        this.sort()?.direction ?? '',
      ].join('|'),
    computation: () => 1,
  });

  readonly #query = computed<CatalogQuery>(() => ({
    q: this.#search.value().trim() || undefined,
    roast: this.roast() || undefined,
    origin: this.origin() || undefined,
    page: this.page(),
    pageSize: this.pageSize(),
    sort: this.sort() ?? undefined,
  }));

  protected readonly pageResource = resource({
    params: () => this.#query(),
    loader: ({ params }) => firstValueFrom(this.#catalog.search(params)),
  });

  /**
   * Keeps the last successfully loaded page on screen while the next one is in
   * flight, so filtering does not blank the layout on every keystroke.
   */
  protected readonly currentPage = linkedSignal<BeanPage | undefined, BeanPage | undefined>({
    source: () => this.pageResource.value(),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly origins = computed(() => this.currentPage()?.facets.origins ?? []);

  protected readonly isFiltered = computed(
    () => !!this.#search.value() || !!this.roast() || !!this.origin(),
  );

  protected onSortChange(sort: BeanSort | null): void {
    this.sort.set(sort);
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
  }

  protected onReset(): void {
    this.searchInput.set('');
    this.roast.set('');
    this.origin.set('');
  }

  protected onReload(): void {
    this.pageResource.reload();
  }
}
