import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DatepickerRangeFilter } from './datepicker-range-filter';

describe('DatepickerRangeFilter', () => {
  let component: DatepickerRangeFilter;
  let fixture: ComponentFixture<DatepickerRangeFilter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatepickerRangeFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(DatepickerRangeFilter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
