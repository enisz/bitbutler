import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewEncapsulation,
  inject,
  input,
} from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import { NgbPopover, NgbPopoverConfig } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'bb-popover',
  imports: [FontAwesomeModule, NgbPopover],
  templateUrl: './bb-popover.html',
  styleUrl: './bb-popover.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbPopover {
  private readonly ngbPopoverConfig = inject(NgbPopoverConfig);

  readonly subject = input('');
  readonly description = input<string | TemplateRef<Element>>('');
  readonly placement = input('right');
  faCircleQuestion = faCircleQuestion;

  constructor() {
    this.ngbPopoverConfig.container = 'body';
  }
}
