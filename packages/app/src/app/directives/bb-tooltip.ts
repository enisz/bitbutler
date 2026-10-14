import {
  Directive,
  ElementRef,
  HostListener,
  booleanAttribute,
  effect,
  inject,
  input,
} from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

export type BbTooltipVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'light'
  | 'dark';

/**
 * The app's tooltip: `NgbTooltip` plus the app's styling options. The tooltip is rendered
 * outside the host element, so the classes added here are styled globally in `styles.scss`.
 *
 * - `singleLine` keeps the text on one line instead of wrapping at the default max width.
 * - `variant` colors the tooltip like the matching Bootstrap contextual color.
 * - `overflowOnly` shows the tooltip only while the host (or `overflowTarget`) is truncated.
 */
@Directive({
  selector: '[bbTooltip]',
  exportAs: 'bbTooltip',
  hostDirectives: [
    {
      directive: NgbTooltip,
      inputs: [
        'ngbTooltip: bbTooltip',
        'placement',
        'container',
        'triggers',
        'openDelay',
        'closeDelay',
        'disableTooltip',
      ],
    },
  ],
})
export class BbTooltip {
  public readonly singleLine = input(false, { transform: booleanAttribute });
  public readonly variant = input<BbTooltipVariant | undefined>(undefined);
  public readonly overflowOnly = input(false, { transform: booleanAttribute });
  public readonly overflowTarget = input<HTMLElement | undefined>(undefined);

  private readonly tooltip = inject(NgbTooltip, { self: true });
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    effect(() => {
      this.tooltip.tooltipClass = [
        this.singleLine() ? 'bb-tooltip-single-line' : '',
        this.variant(),
      ]
        .filter(Boolean)
        .join(' ');
    });
  }

  public open(): void {
    this.tooltip.open();
  }

  public close(): void {
    this.tooltip.close();
  }

  public isOpen(): boolean {
    return this.tooltip.isOpen();
  }

  @HostListener('mouseenter')
  protected onMouseEnter(): void {
    if (!this.overflowOnly()) return;

    const element = this.overflowTarget() ?? this.elementRef.nativeElement;
    this.tooltip.disableTooltip = element.scrollWidth <= element.offsetWidth;
  }
}
