import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BbSpinner } from './bb-spinner';

describe('BbSpinner', () => {
  let component: BbSpinner;
  let fixture: ComponentFixture<BbSpinner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BbSpinner],
    }).compileComponents();

    fixture = TestBed.createComponent(BbSpinner);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
