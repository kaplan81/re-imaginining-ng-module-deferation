import { type HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { roastQueueSeed } from '../../mocks/roast-queue-seed.mock';
import type { QueuePage } from '../../models/queued-order.model';

/**
 * This microfrontend's own mocked backend. The aggregates are computed over the
 * whole queue, not the returned slice - a UI that summed the visible rows would
 * report the wrong totals the moment paging became server-driven.
 *
 * Provided by the widget descriptor, never at application root, so it cannot
 * leak into a host or into a sibling microfrontend's interceptor chain.
 */

const endpoint = '/api/roast-queue';
const defaultLimit = 5;
const minLatencyMs = 180;
const maxLatencyMs = 320;

export const roastQueueMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET' || !req.url.startsWith(endpoint)) {
    return next(req);
  }

  const limit = parsePositiveInt(req.params.get('limit'), defaultLimit);
  const queue = [...roastQueueSeed].sort((a, b) => a.daysToDue - b.daysToDue);

  const body: QueuePage = {
    items: queue.slice(0, limit),
    openOrders: queue.length,
    lateOrders: queue.filter((order) => order.daysToDue < 0).length,
    kgQueued: queue.reduce((sum, order) => sum + order.quantityKg, 0),
  };

  return of(new HttpResponse({ status: 200, body })).pipe(delay(randomLatency()));
};

function parsePositiveInt(raw: string | null, fallback: number): number {
  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function randomLatency(): number {
  return minLatencyMs + Math.random() * (maxLatencyMs - minLatencyMs);
}
