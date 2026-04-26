import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbDate } from '@ng-bootstrap/ng-bootstrap';

import { DatepickerRangeFilter } from './datepicker-range-filter';

describe('DatepickerRangeFilter', () => {
  let component: DatepickerRangeFilter;
  let fixture: ComponentFixture<DatepickerRangeFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = { filterChangedCallback: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [DatepickerRangeFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(DatepickerRangeFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('isFilterActive', () => {
    it('should return false when no from-date is set', () => {
      component.fromDate = null;
      expect(component.isFilterActive()).toBe(false);
    });

    it('should return true when a from-date is set', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      expect(component.isFilterActive()).toBe(true);
    });
  });

  describe('doesFilterPass', () => {
    it('should pass all rows when no filter is active', () => {
      component.fromDate = null;
      expect(component.doesFilterPass({ data: { added_on: 1700000000 } } as any)).toBe(true);
    });

    it('should reject rows with no added_on when filter is active', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      expect(component.doesFilterPass({ data: {} } as any)).toBe(false);
    });

    it('should match exact date when only fromDate is set', () => {
      const localMidnight = new Date(2024, 0, 15).getTime() / 1000;
      component.fromDate = new NgbDate(2024, 1, 15);
      component.toDate = null;
      expect(component.doesFilterPass({ data: { added_on: localMidnight } } as any)).toBe(true);
    });

    it('should accept dates within the from-to range', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      const midJan = new Date(2024, 0, 15).getTime() / 1000;
      expect(component.doesFilterPass({ data: { added_on: midJan } } as any)).toBe(true);
    });

    it('should reject dates outside the range', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      const beforeRange = new Date(2023, 11, 31).getTime() / 1000;
      expect(component.doesFilterPass({ data: { added_on: beforeRange } } as any)).toBe(false);
    });
  });

  describe('getModel / setModel', () => {
    it('should return null when filter is inactive', () => {
      component.fromDate = null;
      expect(component.getModel()).toBeNull();
    });

    it('should return model when fromDate is set', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      expect(component.getModel()).toEqual({
        from: new NgbDate(2024, 1, 1),
        to: new NgbDate(2024, 1, 31),
      });
    });

    it('should restore fromDate and toDate from model', () => {
      component.setModel({ from: new NgbDate(2024, 3, 1), to: new NgbDate(2024, 3, 15) });
      expect(component.fromDate).toEqual(new NgbDate(2024, 3, 1));
      expect(component.toDate).toEqual(new NgbDate(2024, 3, 15));
    });

    it('should clear dates when model is null', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      component.setModel(null);
      expect(component.fromDate).toBeNull();
      expect(component.toDate).toBeNull();
    });
  });

  describe('clear', () => {
    it('should reset all date selections and call filterChangedCallback', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      component.hoveredDate = new NgbDate(2024, 1, 10);
      component.clear();
      expect(component.fromDate).toBeNull();
      expect(component.toDate).toBeNull();
      expect(component.hoveredDate).toBeNull();
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('fmt', () => {
    it('should format a date as YYYY-MM-DD', () => {
      const result = component.fmt(new NgbDate(2024, 3, 5));
      expect(result).toBe('2024-03-05');
    });

    it('should pad single-digit month and day', () => {
      expect(component.fmt(new NgbDate(2024, 1, 7))).toBe('2024-01-07');
    });
  });

  describe('onSelect', () => {
    it('should set fromDate on first selection', () => {
      component.fromDate = null;
      component.toDate = null;
      component.onSelect(new NgbDate(2024, 1, 10));
      expect(component.fromDate).toEqual(new NgbDate(2024, 1, 10));
      expect(component.toDate).toBeNull();
    });

    it('should set toDate when second date is after fromDate', () => {
      component.fromDate = new NgbDate(2024, 1, 5);
      component.toDate = null;
      component.onSelect(new NgbDate(2024, 1, 20));
      expect(component.toDate).toEqual(new NgbDate(2024, 1, 20));
    });

    it('should reset and start new range when second date is not after fromDate', () => {
      component.fromDate = new NgbDate(2024, 1, 20);
      component.toDate = null;
      component.onSelect(new NgbDate(2024, 1, 5));
      expect(component.fromDate).toEqual(new NgbDate(2024, 1, 5));
      expect(component.toDate).toBeNull();
    });
  });
});
