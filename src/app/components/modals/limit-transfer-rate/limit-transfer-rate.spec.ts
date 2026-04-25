import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { LimitTransferRate } from './limit-transfer-rate';

describe('LimitTransferRate', () => {
  let component: LimitTransferRate;
  let fixture: ComponentFixture<LimitTransferRate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LimitTransferRate],
      providers: [NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(LimitTransferRate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
