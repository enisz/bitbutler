import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ViewportService } from '../services/viewport.service';
import { TouchContextMenuDirective } from './touch-context-menu';

@Component({
  template: `<div bbTouchContextMenu id="target"><span id="inner">row</span></div>`,
  imports: [TouchContextMenuDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {}

const press = (el: Element, type: string, x = 0, y = 0): void => {
  el.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }),
  );
};

describe('TouchContextMenuDirective', () => {
  let isTouch: ReturnType<typeof signal<boolean>>;
  let inner: HTMLElement;
  let contextMenus: MouseEvent[];
  let collect: (e: Event) => void;

  const setup = () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ViewportService, useValue: { isTouch } }],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    inner = fixture.debugElement.query(By.css('#inner')).nativeElement;
    contextMenus = [];
    collect = (e: Event) => contextMenus.push(e as MouseEvent);
    document.addEventListener('contextmenu', collect);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    isTouch = signal(true);
  });

  afterEach(() => {
    document.removeEventListener('contextmenu', collect);
    vi.useRealTimers();
  });

  it('opens the context menu at the pressed point after a long press on touch devices', () => {
    setup();
    press(inner, 'pointerdown', 40, 80);
    vi.advanceTimersByTime(499);
    expect(contextMenus).toHaveLength(0);
    vi.advanceTimersByTime(300);

    expect(contextMenus).toHaveLength(1);
    expect(contextMenus[0].target).toBe(inner);
    expect(contextMenus[0].clientX).toBe(40);
    expect(contextMenus[0].clientY).toBe(80);
    expect(contextMenus[0].bubbles).toBe(true);
  });

  it('does nothing without a touch pointer', () => {
    isTouch.set(false);
    setup();
    press(inner, 'pointerdown');
    vi.advanceTimersByTime(1500);
    expect(contextMenus).toHaveLength(0);
  });

  it('does not add a second menu when the browser already fired contextmenu', () => {
    setup();
    press(inner, 'pointerdown');
    vi.advanceTimersByTime(500);
    press(inner, 'contextmenu');
    vi.advanceTimersByTime(1000);
    expect(contextMenus).toHaveLength(1);
  });

  it('does not open a menu for a short tap', () => {
    setup();
    press(inner, 'pointerdown');
    vi.advanceTimersByTime(200);
    press(inner, 'pointerup');
    vi.advanceTimersByTime(1000);
    expect(contextMenus).toHaveLength(0);
  });
});
