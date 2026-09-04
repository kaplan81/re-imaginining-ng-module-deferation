import { type HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { topLotsSeed } from '../../mocks/top-lots-seed.mock';
import type { LotPage } from '../../models/lot.model';

/**
 * This microfrontend's own mocked backend. Ranking happens "server side", so the
 * widget holds only the rows it renders and the component would not change if
 * this were swapped for real HTTP.
 *
 * It is provided by the widget descriptor, never at application root, so it
 * cannot leak into a host or into a sibling microfrontend's interceptor chain.
 */

const endpoint = '/api/top-lots';
const defaultLimit = 5;
const minLatencyMs = 180;
const maxLatencyMs = 320;

export const topLotsMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET' || !req.url.startsWith(endpoint)) {
    return next(req);
  }

  const limit = parsePositiveInt(req.params.get('limit'), defaultLimit);
  const ranked = [...topLotsSeed].sort((a, b) => b.score - a.score);

  const body: LotPage = {
    items: ranked.slice(0, limit),
    total: ranked.length,
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
