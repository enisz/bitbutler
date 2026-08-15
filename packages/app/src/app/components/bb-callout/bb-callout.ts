import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export type BbCalloutVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'light'
  | 'dark';

@Component({
  selector: 'bb-callout',
  standalone: true,
  imports: [FontAwesomeModule],
  templateUrl: './bb-callout.html',
  styleUrl: './bb-callout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbCallout {
  readonly variant = input.required<BbCalloutVariant>();
  readonly icon = input<IconDefinition | null>(null);
  readonly title = input<string | null>(null);
  readonly message = input.required<string>();
}
