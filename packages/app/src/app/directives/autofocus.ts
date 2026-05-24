import { Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

@Directive({
  selector: '[autofocus]',
  standalone: true,
})
export class AutofocusDirective {
  private readonly elementRef = inject(ElementRef);

  readonly autofocus = input<boolean | string>(true);

  constructor() {
    afterNextRender(() => {
      const val = this.autofocus();
      if (val === '' || val === true || val === 'true') {
        setTimeout(() => this.elementRef.nativeElement.focus());
      }
    });
  }
}
