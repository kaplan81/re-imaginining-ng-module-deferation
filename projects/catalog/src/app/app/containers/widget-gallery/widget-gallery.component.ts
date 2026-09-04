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

import { widgets } from '../../../catalog/catalog.widgets';

interface MountedWidget {
  id: string;
  label: string;
  component: Type<unknown>;
  envInjector: EnvironmentInjector;
}

/**
 * Standalone-mode preview of every widget this remote publishes under
 * `./Widgets`, served at :4201/widgets.
 *
 * It exists so the descriptor list has a consumer inside this project. Without
 * it, `catalog.widgets.ts` is only ever exercised by the shell, and a broken
 * descriptor - a renamed export, a bad provider - would surface in someone
 * else's application rather than in this remote's own dev server.
 *
 * It mounts descriptors exactly the way the shell's slot does, with each
 * widget's providers in a child environment injector. That duplication is the
 * same trade the workspace already takes with `remote-origin`: a shared
 * mounting library would be a build-time dependency between independently
 * deployed applications.
 */
@Component({
  selector: 'cat-widget-gallery',
  imports: [NgComponentOutlet],
  template: `
    <section class="cat-gallery">
      <h1 class="cat-gallery__title">Widgets published by this remote</h1>

      <p class="cat-gallery__lead">
        The same descriptors the shell mounts through <code>./Widgets</code>, rendered here by the
        bean catalog remote itself. Each one gets its own environment injector built from the
        providers its descriptor ships.
      </p>

      @for (widget of mounted(); track widget.id) {
        <article class="cat-gallery__item">
          <h2 class="cat-gallery__item-title">
            {{ widget.label }} <code>{{ widget.id }}</code>
          </h2>

          <ng-container
            [ngComponentOutlet]="widget.component"
            [ngComponentOutletEnvironmentInjector]="widget.envInjector"
          />
        </article>
      } @empty {
        <p class="cat-gallery__loading" role="status" aria-live="polite">Loading widgets…</p>
      }
    </section>
  `,
  styles: `
    @use 'tokens' as t;

    .cat-gallery {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .cat-gallery__title {
      font-size: 1.25rem;
      margin: 0;
    }

    .cat-gallery__lead {
      color: t.$color-ink-muted;
      margin: 0;
      max-width: 62ch;
    }

    .cat-gallery__item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 26rem;
    }

    .cat-gallery__item-title {
      @include t.eyebrow;

      margin: 0;

      code {
        font-family: t.$font-mono;
        text-transform: none;
      }
    }

    .cat-gallery__loading {
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
