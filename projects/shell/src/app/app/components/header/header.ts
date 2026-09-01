import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { REMOTES } from '../../models/remote.model';

@Component({
  selector: 'shl-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  /** Navigation is derived from the shell's remote declarations, not hand-written. */
  protected readonly remotes = REMOTES;
}
