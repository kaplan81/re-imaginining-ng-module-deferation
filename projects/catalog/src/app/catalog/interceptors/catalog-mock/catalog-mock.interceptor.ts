import { type HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';

import type { BeanSortFieldET } from '../../enums/bean-sort-field.enum';
import type { RoastLevelET } from '../../enums/roast-level.enum';
import { BEANS_SEED } from '../../mocks/beans-seed.mock';
import type { Bean, BeanFacets, BeanPage } from '../../models/bean.model';
import type { BeanSort } from '../../models/catalog-query.model';

/**
 * Stands in for the catalog service. It answers the same contract a real backend
 * would - filtering, sorting and paging all happen "server side", so the UI only
 * ever holds one page of results and the component code does not change when the
 * mock is swapped for HTTP.
 *
 * It is provided by `catalog.routes.ts`, not at application root, so it exists
 * only while a catalog route is active and can never leak into the shell.
 */

const ENDPOINT = '/api/beans';
const MIN_LATENCY_MS = 180;
const MAX_LATENCY_MS = 320;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;

export const catalogMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET' || !req.url.startsWith(ENDPOINT)) {
    return next(req);
  }

  const page = parsePositiveInt(req.params.get('page'), DEFAULT_PAGE);
  const pageSize = parsePositiveInt(req.params.get('pageSize'), DEFAULT_PAGE_SIZE);
  const search = (req.params.get('q') ?? '').trim().toLowerCase();
  const roast = parseRoast(req.params.get('roast'));
  const origin = (req.params.get('origin') ?? '').trim();
  const sort = parseSort(req.params.get('sort'));

  const filtered = BEANS_SEED.filter((bean) => matches(bean, search, roast, origin));
  const sorted = sort ? sortBeans(filtered, sort) : filtered;
  const start = (page - 1) * pageSize;

  const body: BeanPage = {
    items: sorted.slice(start, start + pageSize),
    total: sorted.length,
    page,
    pageSize,
    facets: buildFacets(filtered),
  };

  return of(new HttpResponse({ status: 200, body })).pipe(delay(randomLatency()));
};

function matches(bean: Bean, search: string, roast: RoastLevelET | null, origin: string): boolean {
  if (roast && bean.roast !== roast) {
    return false;
  }

  if (origin && bean.origin !== origin) {
    return false;
  }

  if (!search) {
    return true;
  }

  return (
    bean.name.toLowerCase().includes(search) ||
    bean.origin.toLowerCase().includes(search) ||
    bean.region.toLowerCase().includes(search) ||
    bean.tastingNotes.some((note) => note.includes(search))
  );
}

function sortBeans(items: readonly Bean[], sort: BeanSort): readonly Bean[] {
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

function buildFacets(items: readonly Bean[]): BeanFacets {
  const origins = [...new Set(BEANS_SEED.map((bean) => bean.origin))].sort();
  const totalStockKg = items.reduce((sum, bean) => sum + bean.stockKg, 0);
  const averageScore = items.length
    ? Number((items.reduce((sum, bean) => sum + bean.score, 0) / items.length).toFixed(1))
    : 0;

  return { origins, totalStockKg, averageScore };
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseRoast(raw: string | null): RoastLevelET | null {
  switch (raw) {
    case 'light':
    case 'medium':
    case 'mediumDark':
    case 'dark':
      return raw;
    default:
      return null;
  }
}

function parseSort(raw: string | null): BeanSort | null {
  if (!raw) {
    return null;
  }

  const [field, direction] = raw.split(':');

  if (!isSortField(field) || (direction !== 'asc' && direction !== 'desc')) {
    return null;
  }

  return { field, direction };
}

function isSortField(value: string): value is BeanSortFieldET {
  switch (value) {
    case 'name':
    case 'origin':
    case 'roast':
    case 'score':
    case 'pricePerKg':
    case 'stockKg':
      return true;
    default:
      return false;
  }
}

function randomLatency(): number {
  return MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
}
