import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TooltipOverflow } from './tooltip-overflow';

@Component({
  template: '<span ngbTooltip="tip" bbTooltipOverflow>text</span>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgbTooltip, TooltipOverflow],
})
class DefaultHostComponent {}

@Component({
  template: `
    <span #target>target text</span>
    <span ngbTooltip="tip" [bbTooltipOverflow]="target">host</span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgbTooltip, TooltipOverflow],
})
class TargetElementHostComponent {
  @ViewChild('target') targetRef!: ElementRef<HTMLElement>;
  @Input() targetElement?: HTMLElement;
}

function setOverflow(element: HTMLElement, scrollWidth: number, offsetWidth: number): void {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, get: () => scrollWidth });
  Object.defineProperty(element, 'offsetWidth', { configurable: true, get: () => offsetWidth });
}

describe('TooltipOverflow', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({ imports: [DefaultHostComponent] });
    const fixture = TestBed.createComponent(DefaultHostComponent);
    const directive = fixture.debugElement
      .query(By.directive(TooltipOverflow))
      .injector.get(TooltipOverflow);
    expect(directive).toBeTruthy();
  });

  it('should disable tooltip when host element is not overflowing', () => {
    TestBed.configureTestingModule({ imports: [DefaultHostComponent] });
    const fixture = TestBed.createComponent(DefaultHostComponent);
    fixture.detectChanges();
    const spanEl: HTMLElement = fixture.debugElement.query(By.css('span')).nativeElement;
    setOverflow(spanEl, 100, 200);
    const tooltip = fixture.debugElement.query(By.directive(NgbTooltip)).injector.get(NgbTooltip);
    fixture.debugElement.query(By.directive(TooltipOverflow)).triggerEventHandler('mouseenter');
    expect(tooltip.disableTooltip).toBe(true);
  });

  it('should enable tooltip when host element is overflowing', () => {
    TestBed.configureTestingModule({ imports: [DefaultHostComponent] });
    const fixture = TestBed.createComponent(DefaultHostComponent);
    fixture.detectChanges();
    const spanEl: HTMLElement = fixture.debugElement.query(By.css('span')).nativeElement;
    setOverflow(spanEl, 300, 200);
    const tooltip = fixture.debugElement.query(By.directive(NgbTooltip)).injector.get(NgbTooltip);
    fixture.debugElement.query(By.directive(TooltipOverflow)).triggerEventHandler('mouseenter');
    expect(tooltip.disableTooltip).toBe(false);
  });

  it('should use targetElement for overflow check when it is an HTMLElement and is overflowing', () => {
    TestBed.configureTestingModule({ imports: [TargetElementHostComponent] });
    const fixture = TestBed.createComponent(TargetElementHostComponent);
    fixture.detectChanges();
    const targetEl: HTMLElement = fixture.debugElement.query(By.css('span')).nativeElement;
    setOverflow(targetEl, 300, 200);
    const tooltip = fixture.debugElement.query(By.directive(NgbTooltip)).injector.get(NgbTooltip);
    fixture.debugElement.query(By.directive(TooltipOverflow)).triggerEventHandler('mouseenter');
    expect(tooltip.disableTooltip).toBe(false);
  });

  it('should use targetElement for overflow check when it is an HTMLElement and is not overflowing', () => {
    TestBed.configureTestingModule({ imports: [TargetElementHostComponent] });
    const fixture = TestBed.createComponent(TargetElementHostComponent);
    fixture.detectChanges();
    const targetEl: HTMLElement = fixture.debugElement.query(By.css('span')).nativeElement;
    setOverflow(targetEl, 100, 200);
    const tooltip = fixture.debugElement.query(By.directive(NgbTooltip)).injector.get(NgbTooltip);
    fixture.debugElement.query(By.directive(TooltipOverflow)).triggerEventHandler('mouseenter');
    expect(tooltip.disableTooltip).toBe(true);
  });
});
