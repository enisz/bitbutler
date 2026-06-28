import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

@Component({
  selector: 'bb-btn-content',
  imports: [FontAwesomeModule],
  templateUrl: './bb-btn-content.html',
  styleUrl: './bb-btn-content.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbBtnContent {
  readonly icon = input.required<IconDefinition>();
  readonly text = input.required<string>();
  readonly position = input<'start' | 'end'>('start');
}
