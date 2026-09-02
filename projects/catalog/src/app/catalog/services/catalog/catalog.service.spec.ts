import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { BeanPage } from '../../models/bean.model';
import { CatalogService } from './catalog.service';

const emptyPage: BeanPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 12,
  facets: { origins: [], totalStockKg: 0, averageScore: 0 },
};

describe('CatalogService', () => {
  let catalog: CatalogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CatalogService],
    });
    catalog = TestBed.inject(CatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should always send page and pageSize', () => {
    catalog.search({ page: 3, pageSize: 24 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/beans');

    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('pageSize')).toBe('24');
    req.flush(emptyPage);
  });

  it('should encode filters and sort into query params', () => {
    catalog
      .search({
        page: 1,
        pageSize: 12,
        q: 'yirgacheffe',
        roast: 'light',
        origin: 'Ethiopia',
        sort: { field: 'score', direction: 'desc' },
      })
      .subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/beans');

    expect(req.request.params.get('q')).toBe('yirgacheffe');
    expect(req.request.params.get('roast')).toBe('light');
    expect(req.request.params.get('origin')).toBe('Ethiopia');
    expect(req.request.params.get('sort')).toBe('score:desc');
    req.flush(emptyPage);
  });

  it('should omit empty optional filters', () => {
    catalog.search({ page: 1, pageSize: 12 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/beans');

    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('roast')).toBe(false);
    expect(req.request.params.has('origin')).toBe(false);
    expect(req.request.params.has('sort')).toBe(false);
    req.flush(emptyPage);
  });
});
