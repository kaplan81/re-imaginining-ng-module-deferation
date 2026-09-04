import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import type { Observable } from 'rxjs';

import type { LotPage } from '../../models/lot.model';

const endpoint = '/api/top-lots';

/**
 * `autoProvided: false` on purpose. This service is listed in the widget
 * descriptor's `providers`, so it is created in the child injector the host
 * builds for the widget and destroyed with it. A root-provided singleton would
 * land in whichever injector happened to be around - the host's, when mounted.
 */
@Service({ autoProvided: false })
export class TopLotsService {
  #http = inject(HttpClient);

  topLots(limit: number): Observable<LotPage> {
    const params = new HttpParams().set('limit', String(limit));

    return this.#http.get<LotPage>(endpoint, { params });
  }
}
