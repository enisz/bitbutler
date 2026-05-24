import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

@Directive({
  selector: '[bbTooltipOverflow]',
  standalone: true,
})
export class TooltipOverflow {
  readonly targetElement = input<HTMLElement | string | undefined>(undefined, {
    alias: 'bbTooltipOverflow',
  });
  private tooltip = inject(NgbTooltip, { host: true, self: true });
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @HostListener('mouseenter')
  onMouseEnter(): void {
    let element = this.elementRef.nativeElement;
    if (this.targetElement() instanceof HTMLElement) {
      element = this.targetElement() as HTMLElement;
    }
    const isOverflowing = element.scrollWidth > element.offsetWidth;
    this.tooltip.disableTooltip = !isOverflowing;
  }
}
