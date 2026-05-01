import { AfterViewInit, Directive, ElementRef, Input, inject } from '@angular/core';

@Directive({
  selector: '[autofocus]',
  standalone: true,
})
export class AutofocusDirective implements AfterViewInit {
  private readonly elementRef = inject(ElementRef);

  private _autofocus = true;

  @Input()
  set autofocus(value: boolean | string) {
    this._autofocus = value === '' || value === true || value === 'true';
  }

  public ngAfterViewInit(): void {
    if (this._autofocus) {
      setTimeout(() => this.elementRef.nativeElement.focus());
    }
  }
}
