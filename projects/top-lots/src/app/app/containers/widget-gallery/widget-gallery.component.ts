import { NgComponentOutlet } from '@angular/common';
import {
  Component,
  createEnvironmentInjector,
  DestroyRef,
  EnvironmentInjector,
  inject,
  signal,
  type Type,
} from '@angular/core';

import { widgets } from '../../../top-lots/top-lots.widgets';

interface MountedWidget {
  id: string;
  label: string;
  component: Type<unknown>;
  envInjector: EnvironmentInjector;
}

/**
 * Standalone preview of every widget this microfrontend publishes, served at
 * :4203.
 *
 * It exists so the descriptor list has a consumer inside this application's own
 * build. Without it, top-lots.widgets.ts would only ever be exercised by a host,
 * and a broken descriptor - a renamed export, a bad provider - would surface in
 * someone else's page rather than here.
 *
 * It mounts descriptors the same way a host does: each widget's providers go
 * into a child environment injector, destroyed with the gallery.
 */
@Component({
  selector: 'tlo-widget-gallery',
  imports: [NgComponentOutlet],
  template: `
    <section class="tlo-gallery">
      <h1 class="tlo-gallery__title">Widgets published by this microfrontend</h1>

      <p class="tlo-gallery__lead">
        The same descriptors a host mounts through <code>./Widgets</code>, rendered here by
        <code>top-lots</code> itself. Each one gets its own environment injector built from the
        providers its descriptor ships.
      </p>

      @for (widget of mounted(); track widget.id) {
        <article class="tlo-gallery__item">
          <h2 class="tlo-gallery__item-title">
            {{ widget.label }} <code>{{ widget.id }}</code>
          </h2>

          <ng-container
            [ngComponentOutlet]="widget.component"
            [ngComponentOutletEnvironmentInjector]="widget.envInjector"
          />
        </article>
      } @empty {
        <p class="tlo-gallery__loading" role="status" aria-live="polite">Loading widgets…</p>
      }
    </section>
  `,
  styles: `
    @use 'tokens' as t;

    .tlo-gallery {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .tlo-gallery__title {
      font-size: 1.25rem;
      margin: 0;
    }

    .tlo-gallery__lead {
      color: t.$color-ink-muted;
      margin: 0;
      max-width: 62ch;

      code {
        font-family: t.$font-mono;
      }
    }

    .tlo-gallery__item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 26rem;
    }

    .tlo-gallery__item-title {
      @include t.eyebrow;

      margin: 0;

      code {
        font-family: t.$font-mono;
        text-transform: none;
      }
    }

    .tlo-gallery__loading {
      color: t.$color-ink-muted;
      margin: 0;
    }
  `,
})
export class WidgetGalleryComponent {
  #parentInjector = inject(EnvironmentInjector);
  #injectors: EnvironmentInjector[] = [];
  #destroyed = false;

  mounted = signal<readonly MountedWidget[]>([]);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#destroyed = true;

      for (const injector of this.#injectors) {
        injector.destroy();
      }

      this.#injectors = [];
    });

    void this.#mountAll();
  }

  async #mountAll(): Promise<void> {
    const mounted: MountedWidget[] = [];

    for (const descriptor of widgets) {
      const loaded = await descriptor.load();

      // The loop awaits, so the gallery may have been destroyed in between.
      if (this.#destroyed) {
        return;
      }

      const envInjector = createEnvironmentInjector(
        [...(loaded.providers ?? [])],
        this.#parentInjector,
      );

      this.#injectors.push(envInjector);
      mounted.push({
        id: descriptor.id,
        label: descriptor.label,
        component: loaded.component,
        envInjector,
      });
    }

    this.mounted.set(mounted);
  }
}
