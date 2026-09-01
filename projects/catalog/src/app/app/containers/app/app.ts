import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Only used when the remote runs on its own. The frame it draws (banner, padding)
 * is deliberately outside the exposed route table, so the shell supplies its own
 * chrome instead of nesting two layouts.
 */
@Component({
  selector: 'cat-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
