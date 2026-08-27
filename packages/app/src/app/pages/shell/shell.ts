import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavRail } from './nav-rail/nav-rail';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, NavRail],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {}
