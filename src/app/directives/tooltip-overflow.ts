import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

@Directive({
  selector: '[bbTooltipOverflow]',
  standalone: true,
})
export class TooltipOverflow {
  @Input('bbTooltipOverflow') targetElement?: HTMLElement | string;
  private tooltip = inject(NgbTooltip, { host: true, self: true });
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @HostListener('mouseenter')
  onMouseEnter(): void {
    let element = this.elementRef.nativeElement;
    if (this.targetElement instanceof HTMLElement) {
      element = this.targetElement;
    }
    const isOverflowing = element.scrollWidth > element.offsetWidth;
    this.tooltip.disableTooltip = !isOverflowing;
  }
}
