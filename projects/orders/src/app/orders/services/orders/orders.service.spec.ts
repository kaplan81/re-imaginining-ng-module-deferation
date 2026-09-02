import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { orderStatuses } from '../../enums/order-status.enum';
import type { OrderPage } from '../../models/order.model';
import { OrdersService } from './orders.service';

const emptyPage: OrderPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
  summary: {
    openOrders: 0,
    kgInRoasting: 0,
    lateOrders: 0,
    revenueEur: 0,
    byStatus: Object.fromEntries(
      orderStatuses.map((status) => [status, 0]),
    ) as OrderPage['summary']['byStatus'],
  },
};

describe('OrdersService', () => {
  let orders: OrdersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), OrdersService],
    });
    orders = TestBed.inject(OrdersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should always send page and pageSize', () => {
    orders.search({ page: 2, pageSize: 25 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/orders');

    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('25');
    req.flush(emptyPage);
  });

  it('should encode search, status and sort into query params', () => {
    orders
      .search({
        page: 1,
        pageSize: 10,
        q: 'lisbon',
        status: 'packed',
        sort: { field: 'dueAt', direction: 'asc' },
      })
      .subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/orders');

    expect(req.request.params.get('q')).toBe('lisbon');
    expect(req.request.params.get('status')).toBe('packed');
    expect(req.request.params.get('sort')).toBe('dueAt:asc');
    req.flush(emptyPage);
  });
});
