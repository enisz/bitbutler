import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { BbOptionText } from './bb-option-text';

@Component({
  template: `
    <div class="bb-option__text" bbOptionText>
      <label class="bb-option__label"> Long label </label>
      <span class="bb-option__sub">Long sub text</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BbOptionText],
})
class HostComponent {}

@Component({
  template: `
    <div class="bb-option__text" bbOptionText>
      <span class="bb-option__label">
        <span class="bb-option__label-text">Label text</span>
        <span class="icon">i</span>
      </span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BbOptionText],
})
class PopoverHostComponent {}

function setOverflow(element: HTMLElement, scrollWidth: number, offsetWidth: number): void {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, get: () => scrollWidth });
  Object.defineProperty(element, 'offsetWidth', { configurable: true, get: () => offsetWidth });
}

function hover(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
}

describe('BbOptionText', () => {
  const setup = <T>(component: new () => T) => {
    TestBed.configureTestingModule({ imports: [component] });
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    const debugElement = fixture.debugElement.query(By.directive(BbOptionText));
    const query = (selector: string) =>
      (debugElement.nativeElement as HTMLElement).querySelector<HTMLElement>(selector)!;
    return {
      element: debugElement.nativeElement as HTMLElement,
      tooltip: debugElement.injector.get(NgbTooltip),
      query,
    };
  };

  it('adds the truncate class to the host', () => {
    const { element } = setup(HostComponent);

    expect(element.classList).toContain('bb-option__text--truncate');
  });

  it('shows the label text when the label overflows', () => {
    const { query, tooltip } = setup(HostComponent);
    const label = query('.bb-option__label');
    setOverflow(label, 300, 200);

    hover(label);

    expect(tooltip.ngbTooltip).toBe('Long label');
    expect(tooltip.disableTooltip).toBe(false);
  });

  it('does not show a tooltip when the hovered line fits', () => {
    const { query, tooltip } = setup(HostComponent);
    const label = query('.bb-option__label');
    setOverflow(label, 100, 200);

    hover(label);

    expect(tooltip.disableTooltip).toBe(true);
  });

  it('switches to the sub-text when the hover moves to it', () => {
    const { query, tooltip } = setup(HostComponent);
    const label = query('.bb-option__label');
    const sub = query('.bb-option__sub');
    setOverflow(label, 300, 200);
    setOverflow(sub, 300, 200);
    const close = vi.spyOn(tooltip, 'close');

    hover(label);
    hover(sub);

    expect(tooltip.ngbTooltip).toBe('Long sub text');
    expect(close).toHaveBeenCalled();
  });

  it('disables the tooltip when the hover moves to a line that fits', () => {
    const { query, tooltip } = setup(HostComponent);
    const label = query('.bb-option__label');
    const sub = query('.bb-option__sub');
    setOverflow(label, 300, 200);
    setOverflow(sub, 100, 200);

    hover(label);
    hover(sub);

    expect(tooltip.disableTooltip).toBe(true);
  });

  it('measures the label text span when present', () => {
    const { query, tooltip } = setup(PopoverHostComponent);
    const text = query('.bb-option__label-text');
    setOverflow(text, 300, 200);

    hover(query('.icon'));
    expect(tooltip.disableTooltip).toBe(true);

    hover(text);
    expect(tooltip.ngbTooltip).toBe('Label text');
    expect(tooltip.disableTooltip).toBe(false);
  });

  it('ignores hovers outside a line', () => {
    const { element, query, tooltip } = setup(HostComponent);
    setOverflow(query('.bb-option__label'), 300, 200);

    hover(element);

    expect(tooltip.disableTooltip).toBe(true);
  });
});
