import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LimitTransferRate } from './limit-transfer-rate';

describe('LimitTransferRate', () => {
  let component: LimitTransferRate;
  let fixture: ComponentFixture<LimitTransferRate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LimitTransferRate],
    }).compileComponents();

    fixture = TestBed.createComponent(LimitTransferRate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
