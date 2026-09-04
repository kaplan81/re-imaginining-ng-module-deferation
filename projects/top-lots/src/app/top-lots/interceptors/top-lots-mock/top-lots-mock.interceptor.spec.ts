import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { topLotsSeed } from '../../mocks/top-lots-seed.mock';
import type { LotPage } from '../../models/lot.model';
import { topLotsMockInterceptor } from './top-lots-mock.interceptor';

const endpoint = '/api/top-lots';

describe('topLotsMockInterceptor', () => {
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([topLotsMockInterceptor]))],
    });
    http = TestBed.inject(HttpClient);
  });

  function fetchPage(params: Record<string, string> = {}): Promise<LotPage> {
    return firstValueFrom(http.get<LotPage>(endpoint, { params }));
  }

  it('should rank by score, highest first', async () => {
    const page = await fetchPage({ limit: String(topLotsSeed.length) });
    const scores = page.items.map((lot) => lot.score);

    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('should return the requested number of lots', async () => {
    const page = await fetchPage({ limit: '3' });

    expect(page.items.length).toBe(3);
  });

  it('should report the whole ranked set as total, not the returned slice', async () => {
    const page = await fetchPage({ limit: '3' });

    expect(page.total).toBe(topLotsSeed.length);
  });

  it('should fall back to a default limit when the parameter is unusable', async () => {
    for (const limit of ['0', '-2', 'abc', '1.5']) {
      const page = await fetchPage({ limit });

      expect(page.items.length).toBe(5);
    }
  });

  it('should put the top-scoring lot first', async () => {
    const page = await fetchPage({ limit: '1' });
    const best = Math.max(...topLotsSeed.map((lot) => lot.score));

    expect(page.items[0].score).toBe(best);
  });

  it('should not answer requests for other endpoints', async () => {
    await expect(firstValueFrom(http.get('/api/something-else'))).rejects.toBeTruthy();
  });
});
