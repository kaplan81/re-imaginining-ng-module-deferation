import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { referenceToday, roastQueueSeed } from '../../mocks/roast-queue-seed.mock';
import type { QueuePage } from '../../models/queued-order.model';
import { roastQueueMockInterceptor } from './roast-queue-mock.interceptor';

const endpoint = '/api/roast-queue';

describe('roastQueueMockInterceptor', () => {
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([roastQueueMockInterceptor]))],
    });
    http = TestBed.inject(HttpClient);
  });

  function fetchQueue(params: Record<string, string> = {}): Promise<QueuePage> {
    return firstValueFrom(http.get<QueuePage>(endpoint, { params }));
  }

  it('should order by due date, soonest first', async () => {
    const page = await fetchQueue({ limit: String(roastQueueSeed.length) });
    const days = page.items.map((order) => order.daysToDue);

    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });

  it('should open on the most overdue order', async () => {
    const page = await fetchQueue({ limit: '1' });
    const earliest = Math.min(...roastQueueSeed.map((order) => order.daysToDue));

    expect(page.items[0].daysToDue).toBe(earliest);
  });

  it('should return the requested number of orders', async () => {
    const page = await fetchQueue({ limit: '2' });

    expect(page.items.length).toBe(2);
  });

  // Aggregates cover the whole queue, not the returned slice - a UI that summed
  // the visible rows would report the wrong totals under server-driven paging.
  it('should aggregate over the whole queue rather than the slice', async () => {
    const page = await fetchQueue({ limit: '2' });

    expect(page.openOrders).toBe(roastQueueSeed.length);
    expect(page.lateOrders).toBe(roastQueueSeed.filter((o) => o.daysToDue < 0).length);
    expect(page.kgQueued).toBe(roastQueueSeed.reduce((sum, o) => sum + o.quantityKg, 0));
  });

  it('should fall back to a default limit when the parameter is unusable', async () => {
    for (const limit of ['0', '-2', 'abc', '1.5']) {
      const page = await fetchQueue({ limit });

      expect(page.items.length).toBe(5);
    }
  });

  // The seed is dated against a fixed reference, not Date.now(), so "9d late"
  // stays "9d late" next month and no test has to freeze the clock.
  it('should date the queue against the fixed reference day', async () => {
    const page = await fetchQueue({ limit: '1' });
    const expected = new Date(`${referenceToday}T00:00:00Z`);

    expected.setUTCDate(expected.getUTCDate() + page.items[0].daysToDue);

    expect(page.items[0].dueAt).toBe(expected.toISOString().slice(0, 10));
  });

  it('should not answer requests for other endpoints', async () => {
    await expect(firstValueFrom(http.get('/api/something-else'))).rejects.toBeTruthy();
  });
});
