import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { appConfig } from './app.config';
import { routes } from './app.routes';

/**
 * The shell's HTTP posture, locked down.
 *
 * Worth being precise about what the risk actually is, because it is not a
 * missing provider. In Angular 22 `HttpClient`, `HttpHandler` and `HttpBackend`
 * are all `providedIn: 'root'` with a fetch backend, so `inject(HttpClient)`
 * succeeds in any application, anywhere - including inside a federated widget,
 * and including when nobody called `provideHttpClient`.
 *
 * What is *not* root-provided is the interceptor chain. `HttpInterceptorHandler`
 * resolves its interceptors from whichever `EnvironmentInjector` it was created
 * in. So a remote's mock backend applies only if the remote's own
 * `provideHttpClient(withInterceptors([...]))` - shipped in its widget
 * descriptor and instantiated in a child injector by the slot - is what the
 * widget resolves. If the shell contributed interceptors of its own they would
 * sit in the chain above every remote's traffic.
 *
 * Hence: the shell installs none, and declares no HTTP on any route. Whether the
 * child injector actually wins for a mounted widget is a runtime property that
 * a unit test cannot observe - it is verified in the browser, where the mock
 * interceptor either answers `/api/beans` or the request 404s.
 */
describe('shell HTTP posture', () => {
  it('should install no HTTP interceptors of its own', () => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers] });

    expect(TestBed.inject(HTTP_INTERCEPTORS, null, { optional: true })).toBeNull();
  });

  it('should not declare providers on any shell route', () => {
    const withProviders = routes.filter((route) => route.providers !== undefined);

    expect(withProviders.map((route) => route.path)).toEqual([]);
  });
});
