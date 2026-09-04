import { Component, input } from '@angular/core';

/**
 * The fifth copy of this strip in the workspace, and deliberately so. See the
 * note in the catalog remote: a shared UI library would be a build-time
 * dependency between independently deployed applications, which is the coupling
 * federation exists to remove. A little duplication is the price.
 */
@Component({
  selector: 'rqu-remote-origin',
  template: `
    <p class="rqu-remote-origin">
      <span class="rqu-remote-origin__dot" aria-hidden="true"></span>
      <span>
        Rendered by the <strong>{{ remote() }}</strong> microfrontend
        <span class="rqu-remote-origin__url">{{ origin() }}</span>
      </span>
    </p>
  `,
  styles: `
    @use 'tokens' as t;

    .rqu-remote-origin {
      align-items: center;
      background: t.$color-accent-orders-soft;
      border: 1px dashed rgba(15, 107, 98, 0.4);
      border-radius: t.$radius-pill;
      color: t.$color-accent-orders;
      display: inline-flex;
      font-size: 0.75rem;
      gap: 0.5rem;
      margin: 0;
      padding: 0.3125rem 0.75rem;
    }

    .rqu-remote-origin__dot {
      background: t.$color-accent-orders;
      border-radius: 50%;
      height: 0.4375rem;
      width: 0.4375rem;
    }

    .rqu-remote-origin__url {
      // No opacity here: the accent at 0.75 over the soft background lands at
      // 3.16:1, under AA. The URL is already de-emphasised by the mono face.
      font-family: t.$font-mono;
      padding-left: 0.25rem;
    }
  `,
})
export class RemoteOriginComponent {
  remote = input.required<string>();

  /**
   * Read at runtime from the module URL, so the strip shows :4204 when a host
   * mounted this widget and the host's own origin never appears here.
   */
  origin = input<string>(remoteOrigin());
}

function remoteOrigin(): string {
  try {
    return new URL(import.meta.url).origin.replace(/^https?:\/\//, '');
  } catch {
    return 'unknown origin';
  }
}
