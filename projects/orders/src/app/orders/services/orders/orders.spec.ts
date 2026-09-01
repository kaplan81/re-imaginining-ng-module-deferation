import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ORDER_STATUSES } from '../../enums/order-status.enum';
import type { OrderPage } from '../../models/order.model';
import { Orders } from './orders';

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
      ORDER_STATUSES.map((status) => [status, 0]),
    ) as OrderPage['summary']['byStatus'],
  },
};

describe('Orders', () => {
  let orders: Orders;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), Orders],
    });
    orders = TestBed.inject(Orders);
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
