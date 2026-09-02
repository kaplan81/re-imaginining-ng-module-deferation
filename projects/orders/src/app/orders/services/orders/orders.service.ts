import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import type { Observable } from 'rxjs';

import type { OrderPage } from '../../models/order.model';
import type { OrdersQuery } from '../../models/orders-query.model';

const ENDPOINT = '/api/orders';

/** Route-provided, not root-provided - see the note in `catalog/services/catalog/catalog.ts`. */
@Service({ autoProvided: false })
export class OrdersService {
  #http = inject(HttpClient);

  search(query: OrdersQuery): Observable<OrderPage> {
    let params = new HttpParams()
      .set('page', String(query.page))
      .set('pageSize', String(query.pageSize));

    if (query.q) {
      params = params.set('q', query.q);
    }

    if (query.status) {
      params = params.set('status', query.status);
    }

    if (query.sort) {
      params = params.set('sort', `${query.sort.field}:${query.sort.direction}`);
    }

    return this.#http.get<OrderPage>(ENDPOINT, { params });
  }
}
