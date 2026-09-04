import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import type { Observable } from 'rxjs';

import type { QueuePage } from '../../models/queued-order.model';

const endpoint = '/api/roast-queue';

/** `autoProvided: false` - listed in the widget descriptor's `providers`. See top-lots. */
@Service({ autoProvided: false })
export class RoastQueueService {
  #http = inject(HttpClient);

  queue(limit: number): Observable<QueuePage> {
    const params = new HttpParams().set('limit', String(limit));

    return this.#http.get<QueuePage>(endpoint, { params });
  }
}
