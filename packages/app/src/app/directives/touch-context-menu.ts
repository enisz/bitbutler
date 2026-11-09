import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { ViewportService } from '../services/viewport.service';
import { LongPressDirective } from './long-press';

/** Long press fires at 500 ms; browsers that raise their own contextmenu do so about then. */
const NATIVE_GRACE_MS = 200;

/**
 * Makes a long press open the element's context menu on touch devices, by dispatching the same
 * `contextmenu` event a right click would. Browsers that already fire `contextmenu` on a long
 * press (Android Chrome) keep their event: a second one would close the menu the first opened.
 */
@Directive({
  selector: '[bbTouchContextMenu]',
  standalone: true,
  hostDirectives: [{ directive: LongPressDirective, inputs: ['bbLongPressEnabled'] }],
  host: {
    '(pointerdown)': 'nativeSeen = false',
    '(contextmenu)': 'nativeSeen = true',
  },
})
export class TouchContextMenuDirective {
  protected nativeSeen = false;

  private readonly isTouch = inject(ViewportService).isTouch;
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const subscription = inject(LongPressDirective, { self: true }).bbLongPress.subscribe((press) =>
      this.onLongPress(press),
    );
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
      if (this.timer) clearTimeout(this.timer);
    });
  }

  private onLongPress(press: MouseEvent): void {
    if (!this.isTouch()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.nativeSeen) return;
      const target = press.target instanceof Element ? press.target : this.element;
      target.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: press.clientX,
          clientY: press.clientY,
          button: 2,
        }),
      );
    }, NATIVE_GRACE_MS);
  }
}
