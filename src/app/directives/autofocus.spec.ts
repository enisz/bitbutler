import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AutofocusDirective } from './autofocus';

@Component({
  template: '<input autofocus />',
  imports: [AutofocusDirective],
})
class TestHostComponent {}

describe('AutofocusDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    const fixture = TestBed.createComponent(TestHostComponent);
    const directive = fixture.debugElement
      .query(By.directive(AutofocusDirective))
      .injector.get(AutofocusDirective);
    expect(directive).toBeTruthy();
  });
});
