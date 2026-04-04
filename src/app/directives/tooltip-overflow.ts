import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

@Directive({
  selector: '[bbTooltipOverflow]',
  standalone: true,
})
export class TooltipOverflow {
  private tooltip = inject(NgbTooltip, { host: true, self: true });

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @HostListener('mouseenter')
  onMouseEnter(): void {
    const element = this.elementRef.nativeElement;
    const isOverflowing = element.scrollWidth > element.offsetWidth;
    this.tooltip.disableTooltip = !isOverflowing;
  }
}
