import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { OPEN_STATUSES } from '../../enums/order-status.enum';
import { ORDERS_SEED } from '../../mocks/orders-seed.mock';
import type { OrderPage } from '../../models/order.model';
import { ordersMockInterceptor } from './orders-mock.interceptor';

const ENDPOINT = '/api/orders';
const ALL = { page: '1', pageSize: '500' };

describe('ordersMockInterceptor', () => {
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([ordersMockInterceptor]))],
    });
    http = TestBed.inject(HttpClient);
  });

  function fetchPage(params: Record<string, string>): Promise<OrderPage> {
    return firstValueFrom(http.get<OrderPage>(ENDPOINT, { params }));
  }

  describe('paging', () => {
    it('should report the full seed as total when unfiltered', async () => {
      const page = await fetchPage({ page: '1', pageSize: '10' });

      expect(page.total).toBe(ORDERS_SEED.length);
      expect(page.items.length).toBe(10);
    });

    it('should slice the requested page', async () => {
      const all = await fetchPage(ALL);
      const third = await fetchPage({ page: '3', pageSize: '10' });

      expect(third.items[0].id).toBe(all.items[20].id);
    });

    it('should fall back to defaults for invalid paging params', async () => {
      const page = await fetchPage({ page: 'nope', pageSize: '-5' });

      expect(page.page).toBe(1);
      expect(page.pageSize).toBe(10);
    });
  });

  describe('search and filter', () => {
    it('should match free text against customer, city, blend and reference', async () => {
      const page = await fetchPage({ ...ALL, q: 'vienna' });

      expect(page.total).toBeGreaterThan(0);
      expect(page.items.every((order) => order.city === 'Vienna')).toBe(true);
    });

    it('should filter by status', async () => {
      const page = await fetchPage({ ...ALL, status: 'roasting' });

      expect(page.total).toBeGreaterThan(0);
      expect(page.items.every((order) => order.status === 'roasting')).toBe(true);
    });

    it('should ignore an unknown status', async () => {
      const page = await fetchPage({ ...ALL, status: 'lost-in-transit' });

      expect(page.total).toBe(ORDERS_SEED.length);
    });
  });

  describe('sorting', () => {
    it('should sort ascending by due date', async () => {
      const page = await fetchPage({ ...ALL, sort: 'dueAt:asc' });
      const dates = page.items.map((order) => order.dueAt);

      expect([...dates].sort()).toEqual(dates);
    });

    it('should sort descending by value', async () => {
      const page = await fetchPage({ ...ALL, sort: 'totalEur:desc' });
      const values = page.items.map((order) => order.totalEur);

      expect([...values].sort((a, b) => b - a)).toEqual(values);
    });
  });

  describe('summary', () => {
    it('should count open orders across the whole pipeline', async () => {
      const page = await fetchPage({ page: '1', pageSize: '1' });
      const expected = ORDERS_SEED.filter((order) => OPEN_STATUSES.includes(order.status)).length;

      expect(page.summary.openOrders).toBe(expected);
    });

    it('should not change while paging or filtering', async () => {
      const first = await fetchPage({ page: '1', pageSize: '10' });
      const filtered = await fetchPage({ ...ALL, status: 'delivered' });

      expect(filtered.summary).toEqual(first.summary);
    });

    it('should have status counts adding up to the seed size', async () => {
      const page = await fetchPage({ page: '1', pageSize: '1' });
      const sum = Object.values(page.summary.byStatus).reduce((total, n) => total + n, 0);

      expect(sum).toBe(ORDERS_SEED.length);
    });

    it('should report at least one late open order so the demo is never empty', async () => {
      const page = await fetchPage({ page: '1', pageSize: '1' });

      expect(page.summary.lateOrders).toBeGreaterThan(0);
    });
  });
});
