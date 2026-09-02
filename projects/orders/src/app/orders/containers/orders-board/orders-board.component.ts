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

import { OrderStatsComponent } from '../../components/order-stats/order-stats.component';
import { OrderTableComponent } from '../../components/order-table/order-table.component';
import { OrdersPagerComponent } from '../../components/orders-pager/orders-pager.component';
import { OrdersToolbarComponent } from '../../components/orders-toolbar/orders-toolbar.component';
import { RemoteOriginComponent } from '../../components/remote-origin/remote-origin.component';
import type { OrderStatusET } from '../../enums/order-status.enum';
import type { OrderPage } from '../../models/order.model';
import type { OrderSort, OrdersQuery } from '../../models/orders-query.model';
import { OrdersService } from '../../services/orders/orders.service';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT: OrderSort = { field: 'dueAt', direction: 'asc' };
const SEARCH_DEBOUNCE_MS = 250;

@Component({
  selector: 'ord-orders-board',
  imports: [
    OrderStatsComponent,
    OrderTableComponent,
    OrdersPagerComponent,
    OrdersToolbarComponent,
    RemoteOriginComponent,
  ],
  templateUrl: './orders-board.component.html',
  styleUrl: './orders-board.component.scss',
})
export class OrdersBoardComponent {
  #orders = inject(OrdersService);

  searchInput = signal('');
  #search = debounced(this.searchInput, SEARCH_DEBOUNCE_MS);

  status = signal<OrderStatusET | ''>('');
  pageSize = signal(DEFAULT_PAGE_SIZE);
  sort = signal<OrderSort | null>(DEFAULT_SORT);

  page = linkedSignal<string, number>({
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

  #query = computed<OrdersQuery>(() => ({
    q: this.#search.value().trim() || undefined,
    status: this.status() || undefined,
    page: this.page(),
    pageSize: this.pageSize(),
    sort: this.sort() ?? undefined,
  }));

  pageResource = resource({
    params: () => this.#query(),
    loader: ({ params }) => firstValueFrom(this.#orders.search(params)),
  });

  /** Stale-while-revalidate: the board keeps its shape while the next page loads. */
  currentPage = linkedSignal<OrderPage | undefined, OrderPage | undefined>({
    source: () => this.pageResource.value(),
    computation: (next, previous) => next ?? previous?.value,
  });

  totalOrders = computed(() => {
    const counts = this.currentPage()?.summary.byStatus;

    return counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : 0;
  });

  onSortChange(sort: OrderSort | null): void {
    this.sort.set(sort);
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
  }

  onReload(): void {
    this.pageResource.reload();
  }
}
