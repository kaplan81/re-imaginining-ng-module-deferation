import { Component, input } from '@angular/core';

/**
 * Deliberately a copy of the catalog remote's component of the same name. See the
 * note there: a shared UI library would reintroduce a build-time dependency
 * between independently deployed applications.
 */
@Component({
  selector: 'ord-remote-origin',
  template: `
    <p class="ord-remote-origin">
      <span class="ord-remote-origin__dot" aria-hidden="true"></span>
      <span>
        Rendered by the <strong>{{ remote() }}</strong> remote
        <span class="ord-remote-origin__url">{{ origin() }}</span>
      </span>
    </p>
  `,
  styles: `
    @use 'tokens' as t;

    .ord-remote-origin {
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

    .ord-remote-origin__dot {
      background: t.$color-accent-orders;
      border-radius: 50%;
      height: 0.4375rem;
      width: 0.4375rem;
    }

    .ord-remote-origin__url {
      font-family: t.$font-mono;
      opacity: 0.75;
      padding-left: 0.25rem;
    }
  `,
})
export class RemoteOrigin {
  readonly remote = input.required<string>();
  readonly origin = input<string>(remoteOrigin());
}

function remoteOrigin(): string {
  try {
    return new URL(import.meta.url).origin.replace(/^https?:\/\//, '');
  } catch {
    return 'unknown origin';
  }
}
