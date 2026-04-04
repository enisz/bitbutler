import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BbPopover } from './bb-popover';

describe('BbPopover', () => {
  let component: BbPopover;
  let fixture: ComponentFixture<BbPopover>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BbPopover],
    }).compileComponents();

    fixture = TestBed.createComponent(BbPopover);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
