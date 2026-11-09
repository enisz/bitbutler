import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LongPressDirective } from './long-press';

@Component({
  template: `<div
    id="target"
    [bbLongPressEnabled]="enabled()"
    (bbLongPress)="longPresses = longPresses + 1"
    (click)="clicks = clicks + 1"
  >
    <span id="inner">x</span>
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LongPressDirective],
})
class HostComponent {
  enabled = signal(true);
  longPresses = 0;
  clicks = 0;
}

function pointer(
  el: Element,
  type: string,
  init: { x?: number; y?: number; button?: number } = {},
): void {
  el.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: init.x ?? 0,
      clientY: init.y ?? 0,
      button: init.button ?? 0,
    }),
  );
}

describe('LongPressDirective', () => {
  let host: HostComponent;
  let fixtureRef: ComponentFixture<HostComponent>;
  let target: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixtureRef = fixture;
    host = fixture.componentInstance;
    target = fixture.debugElement.query(By.css('#target')).nativeElement;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits after 500 ms of holding', () => {
    pointer(target, 'pointerdown');
    vi.advanceTimersByTime(500);
    expect(host.longPresses).toBe(1);
  });

  it('does not emit when released earlier', () => {
    pointer(target, 'pointerdown');
    vi.advanceTimersByTime(300);
    pointer(target, 'pointerup');
    vi.advanceTimersByTime(500);
    expect(host.longPresses).toBe(0);
  });

  it('cancels when the pointer moves more than 10 px', () => {
    pointer(target, 'pointerdown', { x: 5, y: 5 });
    vi.advanceTimersByTime(200);
    pointer(target, 'pointermove', { x: 5, y: 30 });
    vi.advanceTimersByTime(500);
    expect(host.longPresses).toBe(0);
  });

  it('keeps going when the pointer moves less than 10 px', () => {
    pointer(target, 'pointerdown', { x: 5, y: 5 });
    pointer(target, 'pointermove', { x: 8, y: 8 });
    vi.advanceTimersByTime(500);
    expect(host.longPresses).toBe(1);
  });

  it('cancels on pointercancel', () => {
    pointer(target, 'pointerdown');
    vi.advanceTimersByTime(200);
    pointer(target, 'pointercancel');
    vi.advanceTimersByTime(500);
    expect(host.longPresses).toBe(0);
  });

  it('swallows only the click that follows a long press', () => {
    pointer(target, 'pointerdown');
    vi.advanceTimersByTime(500);
    pointer(target, 'pointerup');
    pointer(target, 'click');
    expect(host.clicks).toBe(0);
    pointer(target, 'click');
    expect(host.clicks).toBe(1);
  });

  it('swallows the follow-up click when it lands on a child element', () => {
    pointer(target, 'pointerdown');
    vi.advanceTimersByTime(500);
    pointer(target, 'pointerup');
    pointer(target.querySelector('#inner') as Element, 'click');
    expect(host.clicks).toBe(0);
  });

  it('does nothing and keeps clicks when disabled', () => {
    host.enabled.set(false);
    fixtureRef.detectChanges();
    pointer(target, 'pointerdown');
    vi.advanceTimersByTime(600);
    pointer(target, 'pointerup');
    pointer(target, 'click');
    expect(host.longPresses).toBe(0);
    expect(host.clicks).toBe(1);
  });

  it('ignores the right mouse button', () => {
    pointer(target, 'pointerdown', { button: 2 });
    vi.advanceTimersByTime(600);
    expect(host.longPresses).toBe(0);
  });
});
