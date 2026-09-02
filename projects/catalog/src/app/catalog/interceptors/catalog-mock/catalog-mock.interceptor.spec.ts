import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { beansSeed } from '../../mocks/beans-seed.mock';
import type { BeanPage } from '../../models/bean.model';
import { catalogMockInterceptor } from './catalog-mock.interceptor';

const endpoint = '/api/beans';
const allParams = { page: '1', pageSize: '500' };

describe('catalogMockInterceptor', () => {
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([catalogMockInterceptor]))],
    });
    http = TestBed.inject(HttpClient);
  });

  function fetchPage(params: Record<string, string>): Promise<BeanPage> {
    return firstValueFrom(http.get<BeanPage>(endpoint, { params }));
  }

  describe('paging', () => {
    it('should report the full seed as total when unfiltered', async () => {
      const page = await fetchPage({ page: '1', pageSize: '12' });

      expect(page.total).toBe(beansSeed.length);
      expect(page.items.length).toBe(12);
      expect(page.page).toBe(1);
      expect(page.pageSize).toBe(12);
    });

    it('should slice the requested page', async () => {
      const all = await fetchPage(allParams);
      const second = await fetchPage({ page: '2', pageSize: '12' });

      expect(second.items[0].id).toBe(all.items[12].id);
    });

    it('should return an empty slice past the end', async () => {
      const page = await fetchPage({ page: '999', pageSize: '12' });

      expect(page.items.length).toBe(0);
      expect(page.total).toBe(beansSeed.length);
    });

    it('should fall back to defaults for invalid paging params', async () => {
      const page = await fetchPage({ page: '-2', pageSize: '0' });

      expect(page.page).toBe(1);
      expect(page.pageSize).toBe(12);
    });
  });

  describe('search and filter', () => {
    it('should match free text against origin, region, name and tasting notes', async () => {
      const page = await fetchPage({ ...allParams, q: 'kenya' });

      expect(page.total).toBeGreaterThan(0);
      expect(page.items.every((bean) => bean.origin === 'Kenya')).toBe(true);
    });

    it('should return nothing for a non-matching query', async () => {
      const page = await fetchPage({ ...allParams, q: 'definitely-not-a-coffee' });

      expect(page.total).toBe(0);
      expect(page.items.length).toBe(0);
    });

    it('should filter by roast level', async () => {
      const page = await fetchPage({ ...allParams, roast: 'dark' });

      expect(page.total).toBeGreaterThan(0);
      expect(page.items.every((bean) => bean.roast === 'dark')).toBe(true);
    });

    it('should ignore an unknown roast level rather than returning nothing', async () => {
      const page = await fetchPage({ ...allParams, roast: 'charcoal' });

      expect(page.total).toBe(beansSeed.length);
    });

    it('should combine origin and roast filters', async () => {
      const page = await fetchPage({ ...allParams, origin: 'Brazil', roast: 'light' });

      expect(page.items.every((bean) => bean.origin === 'Brazil' && bean.roast === 'light')).toBe(
        true,
      );
    });
  });

  describe('sorting', () => {
    it('should sort ascending by the requested field', async () => {
      const page = await fetchPage({ ...allParams, sort: 'pricePerKg:asc' });
      const prices = page.items.map((bean) => bean.pricePerKg);

      expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    });

    it('should sort descending by the requested field', async () => {
      const page = await fetchPage({ ...allParams, sort: 'score:desc' });
      const scores = page.items.map((bean) => bean.score);

      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    });

    it('should ignore a malformed sort expression', async () => {
      const sorted = await fetchPage({ ...allParams, sort: 'score:sideways' });
      const unsorted = await fetchPage(allParams);

      expect(sorted.items.map((bean) => bean.id)).toEqual(unsorted.items.map((bean) => bean.id));
    });
  });

  describe('facets', () => {
    it('should list every origin regardless of the active filter', async () => {
      const filtered = await fetchPage({ ...allParams, origin: 'Kenya' });
      const unfiltered = await fetchPage(allParams);

      expect(filtered.facets.origins).toEqual(unfiltered.facets.origins);
    });

    it('should aggregate stock and score over the filtered set, not the page', async () => {
      const page = await fetchPage({ page: '1', pageSize: '1', origin: 'Kenya' });
      const kenyan = beansSeed.filter((bean) => bean.origin === 'Kenya');
      const expectedStock = kenyan.reduce((sum, bean) => sum + bean.stockKg, 0);

      expect(page.items.length).toBe(1);
      expect(page.facets.totalStockKg).toBe(expectedStock);
      expect(page.facets.averageScore).toBeGreaterThan(0);
    });
  });

  it('should pass non-catalog requests through untouched', async () => {
    await expect(firstValueFrom(http.get('/api/something-else'))).rejects.toBeTruthy();
  });
});
