import {
  Component,
  computed,
  debounced,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { OrderStats } from '../../components/order-stats/order-stats';
import { OrderTable } from '../../components/order-table/order-table';
import { OrdersPager } from '../../components/orders-pager/orders-pager';
import { OrdersToolbar } from '../../components/orders-toolbar/orders-toolbar';
import { RemoteOrigin } from '../../components/remote-origin/remote-origin';
import type { OrderStatusET } from '../../enums/order-status.enum';
import type { OrderPage } from '../../models/order.model';
import type { OrderSort, OrdersQuery } from '../../models/orders-query.model';
import { Orders } from '../../services/orders/orders';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT: OrderSort = { field: 'dueAt', direction: 'asc' };
const SEARCH_DEBOUNCE_MS = 250;

@Component({
  selector: 'ord-orders-board',
  imports: [OrderStats, OrderTable, OrdersPager, OrdersToolbar, RemoteOrigin],
  templateUrl: './orders-board.html',
  styleUrl: './orders-board.scss',
})
export class OrdersBoard {
  readonly #orders = inject(Orders);

  protected readonly searchInput = signal('');
  readonly #search = debounced(this.searchInput, SEARCH_DEBOUNCE_MS);

  protected readonly status = signal<OrderStatusET | ''>('');
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly sort = signal<OrderSort | null>(DEFAULT_SORT);

  protected readonly page = linkedSignal<string, number>({
    source: () =>
      [
        this.#search.value(),
        this.status(),
        this.pageSize(),
        this.sort()?.field ?? '',
        this.sort()?.direction ?? '',
      ].join('|'),
    computation: () => 1,
  });

  readonly #query = computed<OrdersQuery>(() => ({
    q: this.#search.value().trim() || undefined,
    status: this.status() || undefined,
    page: this.page(),
    pageSize: this.pageSize(),
    sort: this.sort() ?? undefined,
  }));

  protected readonly pageResource = resource({
    params: () => this.#query(),
    loader: ({ params }) => firstValueFrom(this.#orders.search(params)),
  });

  /** Stale-while-revalidate: the board keeps its shape while the next page loads. */
  protected readonly currentPage = linkedSignal<OrderPage | undefined, OrderPage | undefined>({
    source: () => this.pageResource.value(),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly totalOrders = computed(() => {
    const counts = this.currentPage()?.summary.byStatus;

    return counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : 0;
  });

  protected onSortChange(sort: OrderSort | null): void {
    this.sort.set(sort);
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
  }

  protected onReload(): void {
    this.pageResource.reload();
  }
}
