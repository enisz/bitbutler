import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbDate } from '@ng-bootstrap/ng-bootstrap';

import { DatepickerFilter } from './datepicker-filter';

describe('DatepickerFilter', () => {
  let component: DatepickerFilter;
  let fixture: ComponentFixture<DatepickerFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = { filterChangedCallback: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [DatepickerFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(DatepickerFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('isFilterActive', () => {
    it('should return false when no date is selected', () => {
      component.selectedDate = null;
      expect(component.isFilterActive()).toBe(false);
    });

    it('should return true when a date is selected', () => {
      component.selectedDate = new NgbDate(2024, 1, 15);
      expect(component.isFilterActive()).toBe(true);
    });
  });

  describe('doesFilterPass', () => {
    it('should pass all rows when no filter is active', () => {
      component.selectedDate = null;
      expect(component.doesFilterPass({ data: { added_on: 1700000000 } } as any)).toBe(true);
    });

    it('should match when cell date equals selected date (UTC comparison)', () => {
      const timestamp = 1705276800;
      const utcDate = new Date(timestamp * 1000);
      component.selectedDate = new NgbDate(
        utcDate.getUTCFullYear(),
        utcDate.getUTCMonth() + 1,
        utcDate.getUTCDate(),
      );
      expect(component.doesFilterPass({ data: { added_on: timestamp } } as any)).toBe(true);
    });

    it('should reject rows whose date does not match the filter', () => {
      component.selectedDate = new NgbDate(2024, 1, 15);
      expect(component.doesFilterPass({ data: { added_on: 1000000000 } } as any)).toBe(false);
    });

    it('should reject rows with non-finite added_on', () => {
      component.selectedDate = new NgbDate(2024, 1, 15);
      expect(component.doesFilterPass({ data: { added_on: 'invalid' } } as any)).toBe(false);
    });
  });

  describe('getModel / setModel', () => {
    it('should return null when no date is selected', () => {
      component.selectedDate = null;
      expect(component.getModel()).toBeNull();
    });

    it('should return model with selected date', () => {
      const date = new NgbDate(2024, 1, 15);
      component.selectedDate = date;
      expect(component.getModel()).toEqual({ date });
    });

    it('should restore state from model', () => {
      const date = new NgbDate(2024, 6, 10);
      component.setModel({ date });
      expect(component.selectedDate).toEqual(date);
    });

    it('should clear state when model is null', () => {
      component.selectedDate = new NgbDate(2024, 1, 15);
      component.setModel(null);
      expect(component.selectedDate).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear selectedDate and call filterChangedCallback', () => {
      component.selectedDate = new NgbDate(2024, 1, 15);
      component.clear();
      expect(component.selectedDate).toBeNull();
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });
});
