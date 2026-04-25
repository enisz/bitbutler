import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransferRateLimit } from './transfer-rate-limit';

describe('TransferRateLimit', () => {
  let component: TransferRateLimit;
  let fixture: ComponentFixture<TransferRateLimit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransferRateLimit],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferRateLimit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
