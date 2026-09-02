import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { remotes } from '../../models/remote.model';

@Component({
  selector: 'shl-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  /** Navigation is derived from the shell's remote declarations, not hand-written. */
  remotes = remotes;
}
