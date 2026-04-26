import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AutofocusDirective } from './autofocus';

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

@Component({
  template: '<input [autofocus]="enabled" />',
  imports: [AutofocusDirective],
})
class DynamicHostComponent {
  @Input() enabled: boolean | string = true;
}

@Component({
  template: '<input autofocus />',
  imports: [AutofocusDirective],
})
class StaticTrueHostComponent {}

@Component({
  template: '<input autofocus="true" />',
  imports: [AutofocusDirective],
})
class StringTrueHostComponent {}

@Component({
  template: '<input autofocus="false" />',
  imports: [AutofocusDirective],
})
class StringFalseHostComponent {}

describe('AutofocusDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({ imports: [StaticTrueHostComponent] });
    const fixture = TestBed.createComponent(StaticTrueHostComponent);
    const directive = fixture.debugElement
      .query(By.directive(AutofocusDirective))
      .injector.get(AutofocusDirective);
    expect(directive).toBeTruthy();
  });

  it('should focus element when autofocus attribute is present with no value', async () => {
    TestBed.configureTestingModule({ imports: [StaticTrueHostComponent] });
    const fixture = TestBed.createComponent(StaticTrueHostComponent);
    const inputEl = fixture.debugElement.query(By.css('input')).nativeElement;
    const focusSpy = vi.spyOn(inputEl, 'focus');
    fixture.detectChanges();
    await flushPromises();
    expect(focusSpy).toHaveBeenCalledOnce();
  });

  it('should focus element when autofocus is "true" string', async () => {
    TestBed.configureTestingModule({ imports: [StringTrueHostComponent] });
    const fixture = TestBed.createComponent(StringTrueHostComponent);
    const inputEl = fixture.debugElement.query(By.css('input')).nativeElement;
    const focusSpy = vi.spyOn(inputEl, 'focus');
    fixture.detectChanges();
    await flushPromises();
    expect(focusSpy).toHaveBeenCalledOnce();
  });

  it('should not focus element when autofocus is "false" string', async () => {
    TestBed.configureTestingModule({ imports: [StringFalseHostComponent] });
    const fixture = TestBed.createComponent(StringFalseHostComponent);
    const inputEl = fixture.debugElement.query(By.css('input')).nativeElement;
    const focusSpy = vi.spyOn(inputEl, 'focus');
    fixture.detectChanges();
    await flushPromises();
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('should focus element when autofocus is bound to true', async () => {
    TestBed.configureTestingModule({ imports: [DynamicHostComponent] });
    const fixture = TestBed.createComponent(DynamicHostComponent);
    fixture.componentRef.setInput('enabled', true);
    const inputEl = fixture.debugElement.query(By.css('input')).nativeElement;
    const focusSpy = vi.spyOn(inputEl, 'focus');
    fixture.detectChanges();
    await flushPromises();
    expect(focusSpy).toHaveBeenCalledOnce();
  });

  it('should not focus element when autofocus is bound to false', async () => {
    TestBed.configureTestingModule({ imports: [DynamicHostComponent] });
    const fixture = TestBed.createComponent(DynamicHostComponent);
    fixture.componentRef.setInput('enabled', false);
    const inputEl = fixture.debugElement.query(By.css('input')).nativeElement;
    const focusSpy = vi.spyOn(inputEl, 'focus');
    fixture.detectChanges();
    await flushPromises();
    expect(focusSpy).not.toHaveBeenCalled();
  });
});
