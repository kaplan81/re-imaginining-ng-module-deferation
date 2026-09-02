import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import type { Observable } from 'rxjs';

import type { BeanPage } from '../../models/bean.model';
import type { CatalogQuery } from '../../models/catalog-query.model';

const ENDPOINT = '/api/beans';

/**
 * `autoProvided: false` on purpose. A root-provided singleton would be created
 * inside whichever injector happens to be around - in federated mode that is the
 * shell's. Listing it in the catalog route providers instead ties its lifetime to
 * the catalog feature and keeps the shell free of catalog concepts.
 */
@Service({ autoProvided: false })
export class CatalogService {
  readonly #http = inject(HttpClient);

  search(query: CatalogQuery): Observable<BeanPage> {
    let params = new HttpParams()
      .set('page', String(query.page))
      .set('pageSize', String(query.pageSize));

    if (query.q) {
      params = params.set('q', query.q);
    }

    if (query.roast) {
      params = params.set('roast', query.roast);
    }

    if (query.origin) {
      params = params.set('origin', query.origin);
    }

    if (query.sort) {
      params = params.set('sort', `${query.sort.field}:${query.sort.direction}`);
    }

    return this.#http.get<BeanPage>(ENDPOINT, { params });
  }
}
