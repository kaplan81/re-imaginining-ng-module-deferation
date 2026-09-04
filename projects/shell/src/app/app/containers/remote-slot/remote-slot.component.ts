import { NgComponentOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  createEnvironmentInjector,
  DestroyRef,
  EnvironmentInjector,
  inject,
  input,
  signal,
  type Type,
} from '@angular/core';

import { remotes, type RemoteName } from '../../models/remote.model';
import { loadRemoteWidget } from '../../utils/remote/remote.util';

type SlotState =
  | { status: 'loading' }
  | { status: 'ready'; component: Type<unknown>; envInjector: EnvironmentInjector }
  | { status: 'unreachable' }
  | { status: 'not-found'; available: readonly string[] };

/**
 * Mounts one widget from one remote inside a page the shell owns.
 *
 * This is the component-level counterpart to `loadRemoteRoutes`: where a route
 * hands a whole URL subtree to a remote, a slot hands it a rectangle. The remote
 * still owns everything that matters - its own lazy boundary (the descriptor's
 * `load()`) and its own providers, which arrive as an array the shell drops into
 * a child `EnvironmentInjector` and never inspects.
 *
 * It lives in `containers/` because it is stateful. It is not a route entry, and
 * it does not need to be: what makes a container is holding state and
 * orchestrating, not being the thing a URL resolves to.
 */
@Component({
  selector: 'shl-remote-slot',
  imports: [NgComponentOutlet],
  templateUrl: './remote-slot.component.html',
  styleUrl: './remote-slot.component.scss',
})
export class RemoteSlotComponent {
  remote = input.required<RemoteName>();
  widget = input.required<string>();
  heading = input<string>();

  #parentInjector = inject(EnvironmentInjector);

  /**
   * Owned by the slot, because `NgComponentOutlet` never destroys the
   * environment injector it is handed.
   */
  #envInjector: EnvironmentInjector | undefined;
  #destroyed = false;

  #state = signal<SlotState>({ status: 'loading' });

  /**
   * Narrowed views of the state. `ready` deliberately carries the component and
   * the injector *together* in one signal: `NgComponentOutlet` re-creates its
   * component whenever either input changes, so if the two arrived in separate
   * change-detection passes the first pass would create the widget with no
   * environment injector, its `inject(HttpClient)` would throw NullInjectorError
   * from inside `ngOnChanges`, and a second pass would then rebuild it - one
   * duplicated HTTP request and one error, for nothing.
   */
  ready = computed(() => {
    const state = this.#state();

    return state.status === 'ready' ? state : null;
  });

  notFound = computed(() => {
    const state = this.#state();

    return state.status === 'not-found' ? state : null;
  });

  isLoading = computed(() => this.#state().status === 'loading');
  isUnreachable = computed(() => this.#state().status === 'unreachable');

  label = computed(
    () => remotes.find((remote) => remote.name === this.remote())?.label ?? this.remote(),
  );

  command = computed(() => `npm run start:${this.remote()}`);

  /** Unique per slot, so two slots on one page do not collide in `aria-labelledby`. */
  headingId = computed(() => `shl-slot-${this.remote()}-${this.widget()}`);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#destroyed = true;
      this.#envInjector?.destroy();
      this.#envInjector = undefined;
    });

    // Not the constructor: required inputs are not set yet there. Not an
    // `effect` either - a slot loads once, and re-mounting on an input change
    // would mean destroying an injector the outlet is still rendering from.
    afterNextRender(() => void this.#mount());
  }

  async #mount(): Promise<void> {
    const result = await loadRemoteWidget(this.remote(), this.widget());

    // Two awaits happened inside `loadRemoteWidget`. The slot may already be
    // gone - navigated away, or the `@defer` block torn down - in which case
    // `onDestroy` has run and nothing would ever destroy an injector created
    // now.
    if (this.#destroyed) {
      return;
    }

    if (result.status !== 'ready') {
      this.#state.set(result);

      return;
    }

    // Built imperatively rather than in a `computed`: a recomputed injector is a
    // new identity, which makes `NgComponentOutlet` tear down and rebuild the
    // widget and leaks the previous injector.
    this.#envInjector = createEnvironmentInjector(
      [...(result.widget.providers ?? [])],
      this.#parentInjector,
    );

    this.#state.set({
      status: 'ready',
      component: result.widget.component,
      envInjector: this.#envInjector,
    });
  }
}
