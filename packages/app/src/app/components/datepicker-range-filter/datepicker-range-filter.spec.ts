import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbDate } from '@ng-bootstrap/ng-bootstrap';
import { DEFAULT_GENERAL_SETTINGS } from '../../models/general-settings.model';
import { DateFormatService } from '../../services/date-format.service';
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
    it('should return false when no applied from-date is set', () => {
      component.appliedFrom = null;
      expect(component.isFilterActive()).toBe(false);
    });

    it('should return true when an applied from-date is set', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      expect(component.isFilterActive()).toBe(true);
    });

    it('should ignore a staged (unapplied) from-date', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.appliedFrom = null;
      expect(component.isFilterActive()).toBe(false);
    });
  });

  describe('doesFilterPass', () => {
    it('should pass all rows when no filter is applied', () => {
      component.appliedFrom = null;
      expect(component.doesFilterPass({ data: { added_on: 1700000000 } } as any)).toBe(true);
    });

    it('should reject rows with no added_on when filter is applied', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      expect(component.doesFilterPass({ data: {} } as any)).toBe(false);
    });

    it('should match exact date when only appliedFrom is set', () => {
      const localMidnight = new Date(2024, 0, 15).getTime() / 1000;
      component.appliedFrom = new NgbDate(2024, 1, 15);
      component.appliedTo = null;
      expect(component.doesFilterPass({ data: { added_on: localMidnight } } as any)).toBe(true);
    });

    it('should accept dates within the appliedFrom-appliedTo range', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      const midJan = new Date(2024, 0, 15).getTime() / 1000;
      expect(component.doesFilterPass({ data: { added_on: midJan } } as any)).toBe(true);
    });

    it('should reject dates outside the applied range', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      const beforeRange = new Date(2023, 11, 31).getTime() / 1000;
      expect(component.doesFilterPass({ data: { added_on: beforeRange } } as any)).toBe(false);
    });

    it('should ignore a staged (unapplied) range', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      component.appliedFrom = null;
      component.appliedTo = null;
      const midJan = new Date(2024, 0, 15).getTime() / 1000;
      expect(component.doesFilterPass({ data: { added_on: midJan } } as any)).toBe(true);
    });
  });

  describe('getModel / setModel', () => {
    it('should return null when filter is inactive', () => {
      component.appliedFrom = null;
      expect(component.getModel()).toBeNull();
    });

    it('should return model when appliedFrom is set', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      expect(component.getModel()).toEqual({
        from: new NgbDate(2024, 1, 1),
        to: new NgbDate(2024, 1, 31),
      });
    });

    it('should restore both staged and applied dates from model', () => {
      component.setModel({ from: new NgbDate(2024, 3, 1), to: new NgbDate(2024, 3, 15) });
      expect(component.appliedFrom).toEqual(new NgbDate(2024, 3, 1));
      expect(component.appliedTo).toEqual(new NgbDate(2024, 3, 15));
      expect(component.fromDate).toEqual(new NgbDate(2024, 3, 1));
      expect(component.toDate).toEqual(new NgbDate(2024, 3, 15));
    });

    it('should clear both staged and applied dates when model is null', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      component.setModel(null);
      expect(component.appliedFrom).toBeNull();
      expect(component.appliedTo).toBeNull();
      expect(component.fromDate).toBeNull();
      expect(component.toDate).toBeNull();
    });
  });

  describe('apply', () => {
    it('should copy staged dates into applied and call filterChangedCallback', () => {
      component.fromDate = new NgbDate(2024, 2, 1);
      component.toDate = new NgbDate(2024, 2, 10);
      component.appliedFrom = null;
      component.appliedTo = null;
      component.apply();
      expect(component.appliedFrom).toEqual(new NgbDate(2024, 2, 1));
      expect(component.appliedTo).toEqual(new NgbDate(2024, 2, 10));
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is true when staged and applied are both empty', () => {
      component.fromDate = null;
      component.toDate = null;
      component.appliedFrom = null;
      component.appliedTo = null;
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is true when staged matches applied exactly', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is false when a staged fromDate has no applied counterpart yet', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = null;
      component.appliedFrom = null;
      component.appliedTo = null;
      expect(component.isApplyDisabled()).toBe(false);
    });

    it('is false when staged range differs from applied range', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 20);
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      expect(component.isApplyDisabled()).toBe(false);
    });
  });

  describe('afterGuiAttached', () => {
    it('resets staged dates from applied dates', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      component.fromDate = new NgbDate(2024, 5, 5);
      component.toDate = null;
      component.hoveredDate = new NgbDate(2024, 5, 6);

      component.afterGuiAttached();

      expect(component.fromDate).toEqual(new NgbDate(2024, 1, 1));
      expect(component.toDate).toEqual(new NgbDate(2024, 1, 31));
      expect(component.hoveredDate).toBeNull();
    });

    it('resets staged dates to null when nothing is applied', () => {
      component.appliedFrom = null;
      component.appliedTo = null;
      component.fromDate = new NgbDate(2024, 5, 5);
      component.toDate = new NgbDate(2024, 5, 10);

      component.afterGuiAttached();

      expect(component.fromDate).toBeNull();
      expect(component.toDate).toBeNull();
    });
  });

  describe('clear', () => {
    it('should reset all staged and applied date selections and call filterChangedCallback', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      component.hoveredDate = new NgbDate(2024, 1, 10);
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      component.clear();
      expect(component.fromDate).toBeNull();
      expect(component.toDate).toBeNull();
      expect(component.hoveredDate).toBeNull();
      expect(component.appliedFrom).toBeNull();
      expect(component.appliedTo).toBeNull();
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

    it('should not call filterChangedCallback - picking dates only stages them', () => {
      component.fromDate = null;
      component.toDate = null;
      component.onSelect(new NgbDate(2024, 1, 10));
      component.onSelect(new NgbDate(2024, 1, 20));
      expect(mockParams.filterChangedCallback).not.toHaveBeenCalled();
    });
  });

  describe('fmt with a non-default date format', () => {
    it('formats using the eu preset date-only pattern from DateFormatService', () => {
      const dateFormatService = TestBed.inject(DateFormatService);
      dateFormatService.applyFromSettings({
        ...DEFAULT_GENERAL_SETTINGS,
        dateFormat: { preset: 'eu', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
      });

      expect(component.fmt(new NgbDate(2024, 3, 5))).toBe('05.03.2024');
    });
  });

  describe('isRangeStart', () => {
    it('is false when no date is selected', () => {
      component.fromDate = null;
      component.toDate = null;
      expect(component.isRangeStart(new NgbDate(2024, 1, 10))).toBe(false);
    });

    it('is false for a single selected date with no hover and no toDate', () => {
      component.fromDate = new NgbDate(2024, 1, 10);
      component.toDate = null;
      component.hoveredDate = null;
      expect(component.isRangeStart(new NgbDate(2024, 1, 10))).toBe(false);
    });

    it('is true for the fromDate once a toDate is set', () => {
      component.fromDate = new NgbDate(2024, 1, 10);
      component.toDate = new NgbDate(2024, 1, 20);
      expect(component.isRangeStart(new NgbDate(2024, 1, 10))).toBe(true);
    });

    it('is true for the fromDate while hovering past it with no toDate yet', () => {
      component.fromDate = new NgbDate(2024, 1, 10);
      component.toDate = null;
      component.hoveredDate = new NgbDate(2024, 1, 15);
      expect(component.isRangeStart(new NgbDate(2024, 1, 10))).toBe(true);
    });

    it('is false for a date other than fromDate', () => {
      component.fromDate = new NgbDate(2024, 1, 10);
      component.toDate = new NgbDate(2024, 1, 20);
      expect(component.isRangeStart(new NgbDate(2024, 1, 15))).toBe(false);
    });
  });
});
