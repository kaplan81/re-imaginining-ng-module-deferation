import { Component, input } from '@angular/core';

/**
 * A small "who rendered this" strip. Every remote in this workspace ships its own
 * copy rather than importing a shared component: a shared UI library would be a
 * build-time dependency between independently deployed applications, which is
 * exactly what federation is supposed to avoid. A little duplication is the price.
 */
@Component({
  selector: 'cat-remote-origin',
  template: `
    <p class="cat-remote-origin">
      <span class="cat-remote-origin__dot" aria-hidden="true"></span>
      <span class="cat-remote-origin__text">
        Rendered by the <strong>{{ remote() }}</strong> remote
        <span class="cat-remote-origin__url">{{ origin() }}</span>
      </span>
    </p>
  `,
  styles: `
    @use 'tokens' as t;

    .cat-remote-origin {
      align-items: center;
      background: t.$color-accent-catalog-soft;
      border: 1px dashed rgba(194, 96, 13, 0.4);
      border-radius: t.$radius-pill;
      color: t.$color-accent-catalog;
      display: inline-flex;
      font-size: 0.75rem;
      gap: 0.5rem;
      margin: 0;
      padding: 0.3125rem 0.75rem;
    }

    .cat-remote-origin__dot {
      background: t.$color-accent-catalog;
      border-radius: 50%;
      height: 0.4375rem;
      width: 0.4375rem;
    }

    .cat-remote-origin__url {
      font-family: t.$font-mono;
      opacity: 0.75;
      padding-left: 0.25rem;
    }
  `,
})
export class RemoteOriginComponent {
  remote = input.required<string>();

  /**
   * Read at runtime from the module URL, so the strip shows :4201 when the shell
   * loaded this component and the shell's own origin never appears here.
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
