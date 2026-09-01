import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Only used when the remote runs on its own on :4202. */
@Component({
  selector: 'ord-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
