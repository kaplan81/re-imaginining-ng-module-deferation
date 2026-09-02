import { type HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';

import type { OrderSortFieldET } from '../../enums/order-sort-field.enum';
import { openStatuses, orderStatuses, type OrderStatusET } from '../../enums/order-status.enum';
import { ordersSeed } from '../../mocks/orders-seed.mock';
import type { Order, OrderPage, OrderSummary } from '../../models/order.model';
import type { OrderSort } from '../../models/orders-query.model';

/**
 * Stands in for the fulfilment service. Filtering, sorting, paging and the
 * summary aggregates are all computed here so the client contract matches what a
 * real API would expose.
 *
 * Provided by `orders.routes.ts` - never at application root - so it cannot
 * intercept traffic belonging to the shell or to the catalog remote. Two remotes
 * each running their own interceptor chain on the same page is precisely why the
 * host must not own `HttpClient`.
 */

const endpoint = '/api/orders';
const minLatencyMs = 200;
const maxLatencyMs = 380;
const defaultPage = 1;
const defaultPageSize = 10;

export const ordersMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET' || !req.url.startsWith(endpoint)) {
    return next(req);
  }

  const page = parsePositiveInt(req.params.get('page'), defaultPage);
  const pageSize = parsePositiveInt(req.params.get('pageSize'), defaultPageSize);
  const search = (req.params.get('q') ?? '').trim().toLowerCase();
  const status = parseStatus(req.params.get('status'));
  const sort = parseSort(req.params.get('sort'));

  const filtered = ordersSeed.filter((order) => matches(order, search, status));
  const sorted = sort ? sortOrders(filtered, sort) : filtered;
  const start = (page - 1) * pageSize;

  const body: OrderPage = {
    items: sorted.slice(start, start + pageSize),
    total: sorted.length,
    page,
    pageSize,
    summary: buildSummary(),
  };

  return of(new HttpResponse({ status: 200, body })).pipe(delay(randomLatency()));
};

function matches(order: Order, search: string, status: OrderStatusET | null): boolean {
  if (status && order.status !== status) {
    return false;
  }

  if (!search) {
    return true;
  }

  return (
    order.customer.toLowerCase().includes(search) ||
    order.city.toLowerCase().includes(search) ||
    order.blend.toLowerCase().includes(search) ||
    order.reference.toLowerCase().includes(search)
  );
}

function sortOrders(items: readonly Order[], sort: OrderSort): readonly Order[] {
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    const left = a[sort.field];
    const right = b[sort.field];

    if (left < right) {
      return -factor;
    }

    if (left > right) {
      return factor;
    }

    return 0;
  });
}

/** Always computed over the full data set, so the tiles do not change while paging. */
function buildSummary(): OrderSummary {
  const byStatus = Object.fromEntries(
    orderStatuses.map((status) => [
      status,
      ordersSeed.filter((order) => order.status === status).length,
    ]),
  ) as Record<OrderStatusET, number>;

  const open = ordersSeed.filter((order) => openStatuses.includes(order.status));

  return {
    openOrders: open.length,
    kgInRoasting: ordersSeed
      .filter((order) => order.status === 'roasting')
      .reduce((sum, order) => sum + order.quantityKg, 0),
    lateOrders: open.filter((order) => order.daysToDue < 0).length,
    revenueEur: Number(ordersSeed.reduce((sum, order) => sum + order.totalEur, 0).toFixed(2)),
    byStatus,
  };
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseStatus(raw: string | null): OrderStatusET | null {
  return raw && (orderStatuses as readonly string[]).includes(raw) ? (raw as OrderStatusET) : null;
}

function parseSort(raw: string | null): OrderSort | null {
  if (!raw) {
    return null;
  }

  const [field, direction] = raw.split(':');

  if (!isSortField(field) || (direction !== 'asc' && direction !== 'desc')) {
    return null;
  }

  return { field, direction };
}

function isSortField(value: string): value is OrderSortFieldET {
  switch (value) {
    case 'reference':
    case 'customer':
    case 'status':
    case 'quantityKg':
    case 'totalEur':
    case 'dueAt':
      return true;
    default:
      return false;
  }
}

function randomLatency(): number {
  return minLatencyMs + Math.random() * (maxLatencyMs - minLatencyMs);
}
