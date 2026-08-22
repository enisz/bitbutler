import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-bb-logo',
  standalone: true,
  imports: [],
  templateUrl: './bb-logo.html',
  styleUrl: './bb-logo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbLogo {
  readonly size = input<number>(190);
}
