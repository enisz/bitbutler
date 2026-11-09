import { DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';

const MOVE_TOLERANCE_PX = 10;

/**
 * Emits `bbLongPress` when a pointer is held on the element without moving. The click that
 * follows a successful long press is swallowed (capture phase) so tap handlers on the same
 * element do not fire as well.
 */
@Directive({
  selector: '[bbLongPress]',
  standalone: true,
  host: {
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'cancel()',
    '(pointercancel)': 'cancel()',
    '(pointerleave)': 'cancel()',
  },
})
export class LongPressDirective {
  public readonly bbLongPress = output<MouseEvent>();
  public readonly bbLongPressMs = input(500);
  /** When false the directive is inert: no timer and no swallowed clicks (e.g. mouse users). */
  public readonly bbLongPressEnabled = input(true);

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private startX = 0;
  private startY = 0;
  private swallowNextClick = false;

  constructor() {
    const onClick = (event: Event) => {
      if (!this.swallowNextClick) return;
      this.swallowNextClick = false;
      event.stopPropagation();
      event.preventDefault();
    };
    this.element.addEventListener('click', onClick, true);
    inject(DestroyRef).onDestroy(() => {
      this.clearTimer();
      this.element.removeEventListener('click', onClick, true);
    });
  }

  protected onDown(event: MouseEvent): void {
    if (!this.bbLongPressEnabled() || event.button !== 0) return;
    this.clearTimer();
    this.swallowNextClick = false;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.swallowNextClick = true;
      this.bbLongPress.emit(event);
    }, this.bbLongPressMs());
  }

  protected onMove(event: MouseEvent): void {
    if (!this.timer) return;
    if (
      Math.abs(event.clientX - this.startX) > MOVE_TOLERANCE_PX ||
      Math.abs(event.clientY - this.startY) > MOVE_TOLERANCE_PX
    ) {
      this.clearTimer();
    }
  }

  protected cancel(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
