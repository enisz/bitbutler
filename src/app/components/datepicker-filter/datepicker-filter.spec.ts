import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DatepickerFilter } from './datepicker-filter';

describe('DatepickerFilter', () => {
  let component: DatepickerFilter;
  let fixture: ComponentFixture<DatepickerFilter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatepickerFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(DatepickerFilter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
