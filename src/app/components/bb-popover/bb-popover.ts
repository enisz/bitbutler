import { Component, Input, TemplateRef, ViewEncapsulation, inject } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import { NgbPopover, NgbPopoverConfig } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'bb-popover',
  imports: [FontAwesomeModule, NgbPopover],
  templateUrl: './bb-popover.html',
  styleUrl: './bb-popover.scss',
  encapsulation: ViewEncapsulation.None,
})
export class BbPopover {
  private readonly ngbPopoverConfig = inject(NgbPopoverConfig);

  @Input() subject: string = '';
  @Input() description: string | TemplateRef<Element> = '';
  @Input() placement: string = 'right';
  faCircleQuestion = faCircleQuestion;

  constructor() {
    this.ngbPopoverConfig.container = 'body';
  }
}
