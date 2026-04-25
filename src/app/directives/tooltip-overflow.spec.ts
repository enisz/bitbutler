import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TooltipOverflow } from './tooltip-overflow';

@Component({
  template: '<span ngbTooltip="tip" bbTooltipOverflow>text</span>',
  imports: [NgbTooltip, TooltipOverflow],
})
class TestHostComponent {}

describe('TooltipOverflow', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    const fixture = TestBed.createComponent(TestHostComponent);
    const directive = fixture.debugElement
      .query(By.directive(TooltipOverflow))
      .injector.get(TooltipOverflow);
    expect(directive).toBeTruthy();
  });
});
