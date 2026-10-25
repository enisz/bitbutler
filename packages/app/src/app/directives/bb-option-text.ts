import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

const LINE_SELECTOR = '.bb-option__label-text, .bb-option__sub, .bb-option__label';

/**
 * The text block of an option row (`.bb-option__text`): keeps the label and sub-text on a single
 * line, truncated with an ellipsis (styled by `.bb-option__text--truncate` in `styles.scss`).
 * Hovering a line that is cut off shows a tooltip with its full text; a line that fits shows none.
 *
 * A label that also holds a `bb-popover` wraps its text in `.bb-option__label-text`, which is then
 * the truncated and measured element, so the popover icon stays visible.
 */
@Directive({
  selector: '[bbOptionText]',
  host: { class: 'bb-option__text--truncate' },
  hostDirectives: [{ directive: NgbTooltip, inputs: ['container'] }],
})
export class BbOptionText {
  private readonly tooltip = inject(NgbTooltip, { self: true });
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private hoveredLine: HTMLElement | null = null;

  constructor() {
    this.tooltip.placement = 'bottom';
    this.tooltip.tooltipClass = 'bb-tooltip-single-line';
    this.tooltip.disableTooltip = true;
  }

  @HostListener('mouseover', ['$event'])
  protected onMouseOver(event: MouseEvent): void {
    const line = this.resolveLine(event.target as HTMLElement);
    if (line === this.hoveredLine) return;

    this.hoveredLine = line;
    this.tooltip.close();

    if (!line || line.scrollWidth <= line.offsetWidth) {
      this.tooltip.disableTooltip = true;
      return;
    }

    this.tooltip.ngbTooltip = (line.textContent ?? '').replace(/\s+/g, ' ').trim();
    this.tooltip.disableTooltip = false;
    this.tooltip.open();
  }

  @HostListener('mouseleave')
  protected onMouseLeave(): void {
    this.hoveredLine = null;
  }

  private resolveLine(target: HTMLElement): HTMLElement | null {
    const line = target.closest<HTMLElement>(LINE_SELECTOR);
    if (!line || !this.elementRef.nativeElement.contains(line)) return null;

    // A label that has a dedicated text span is only a line through that span.
    return line.matches('.bb-option__label') && line.querySelector('.bb-option__label-text')
      ? null
      : line;
  }
}
