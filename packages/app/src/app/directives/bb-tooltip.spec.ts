import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { BbTooltip, BbTooltipVariant } from './bb-tooltip';

@Component({
  template: `
    <span
      bbTooltip="tip"
      placement="bottom"
      [overflowOnly]="overflowOnly()"
      [singleLine]="singleLine()"
      [variant]="variant()"
      >text</span
    >
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BbTooltip],
})
class HostComponent {
  public readonly overflowOnly = signal(false);
  public readonly singleLine = signal(false);
  public readonly variant = signal<BbTooltipVariant | undefined>(undefined);
}

@Component({
  template: `
    <span #target>target text</span>
    <span bbTooltip="tip" overflowOnly [overflowTarget]="target">host</span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BbTooltip],
})
class TargetHostComponent {}

function setOverflow(element: HTMLElement, scrollWidth: number, offsetWidth: number): void {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, get: () => scrollWidth });
  Object.defineProperty(element, 'offsetWidth', { configurable: true, get: () => offsetWidth });
}

describe('BbTooltip', () => {
  const setup = (overflowOnly = false) => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.overflowOnly.set(overflowOnly);
    fixture.detectChanges();
    const debugElement = fixture.debugElement.query(By.directive(BbTooltip));
    return {
      fixture,
      host: fixture.componentInstance,
      element: debugElement.nativeElement as HTMLElement,
      debugElement,
      tooltip: debugElement.injector.get(NgbTooltip),
    };
  };

  it('forwards the content and placement to NgbTooltip', () => {
    const { tooltip } = setup();

    expect(tooltip.ngbTooltip).toBe('tip');
    expect(tooltip.placement).toBe('bottom');
  });

  describe('classes', () => {
    it('adds no class by default', () => {
      const { tooltip } = setup();

      expect(tooltip.tooltipClass).toBe('');
    });

    it('adds the single-line class', () => {
      const { fixture, host, tooltip } = setup();

      host.singleLine.set(true);
      fixture.detectChanges();

      expect(tooltip.tooltipClass).toBe('bb-tooltip-single-line');
    });

    it('adds the variant class', () => {
      const { fixture, host, tooltip } = setup();

      host.variant.set('danger');
      fixture.detectChanges();

      expect(tooltip.tooltipClass).toBe('danger');
    });

    it('combines single-line and variant, and drops the variant when unset', () => {
      const { fixture, host, tooltip } = setup();

      host.singleLine.set(true);
      host.variant.set('warning');
      fixture.detectChanges();
      expect(tooltip.tooltipClass).toBe('bb-tooltip-single-line warning');

      host.variant.set(undefined);
      fixture.detectChanges();
      expect(tooltip.tooltipClass).toBe('bb-tooltip-single-line');
    });
  });

  describe('overflowOnly', () => {
    it('leaves the tooltip enabled on hover when overflowOnly is off', () => {
      const { element, debugElement, tooltip } = setup();
      setOverflow(element, 100, 200);

      debugElement.triggerEventHandler('mouseenter');

      expect(tooltip.disableTooltip).toBe(false);
    });

    it('disables the tooltip when the host is not overflowing', () => {
      const { element, debugElement, tooltip } = setup(true);
      setOverflow(element, 100, 200);

      debugElement.triggerEventHandler('mouseenter');

      expect(tooltip.disableTooltip).toBe(true);
    });

    it('enables the tooltip when the host is overflowing', () => {
      const { element, debugElement, tooltip } = setup(true);
      setOverflow(element, 300, 200);

      debugElement.triggerEventHandler('mouseenter');

      expect(tooltip.disableTooltip).toBe(false);
    });

    it('checks overflowTarget instead of the host when given', () => {
      TestBed.configureTestingModule({ imports: [TargetHostComponent] });
      const fixture = TestBed.createComponent(TargetHostComponent);
      fixture.detectChanges();
      const target: HTMLElement = fixture.debugElement.query(By.css('span')).nativeElement;
      const debugElement = fixture.debugElement.query(By.directive(BbTooltip));
      const tooltip = debugElement.injector.get(NgbTooltip);

      setOverflow(target, 300, 200);
      debugElement.triggerEventHandler('mouseenter');
      expect(tooltip.disableTooltip).toBe(false);

      setOverflow(target, 100, 200);
      debugElement.triggerEventHandler('mouseenter');
      expect(tooltip.disableTooltip).toBe(true);
    });
  });

  it('opens and closes the underlying tooltip through the exported API', () => {
    const { debugElement, tooltip } = setup();
    const directive = debugElement.injector.get(BbTooltip);
    const open = vi.spyOn(tooltip, 'open');
    const close = vi.spyOn(tooltip, 'close');

    directive.open();
    directive.close();

    expect(open).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
