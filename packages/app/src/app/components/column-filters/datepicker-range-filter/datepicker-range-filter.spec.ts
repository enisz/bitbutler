import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbDate } from '@ng-bootstrap/ng-bootstrap';
import { DEFAULT_GENERAL_SETTINGS } from '../../../models/general-settings.model';
import { DateFormatService } from '../../../services/date-format.service';
import { DatepickerRangeFilter } from './datepicker-range-filter';

describe('DatepickerRangeFilter', () => {
  let component: DatepickerRangeFilter;
  let fixture: ComponentFixture<DatepickerRangeFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      api: { hidePopupMenu: vi.fn() },
      getValue: vi.fn((node: { data: any }) => node.data?.added_on),
    };

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

  describe('ag-grid popup containment', () => {
    it('appends separate popup portal elements for the month and year selects, each tagged for ag-grid to treat as part of the filter popup', () => {
      const monthPortal = document.querySelector(component.monthPopupPortalSelector);
      const yearPortal = document.querySelector(component.yearPopupPortalSelector);
      expect(monthPortal).not.toBeNull();
      expect(yearPortal).not.toBeNull();
      expect(monthPortal).not.toBe(yearPortal);
      expect(monthPortal!.classList.contains('ag-custom-component-popup')).toBe(true);
      expect(yearPortal!.classList.contains('ag-custom-component-popup')).toBe(true);
    });

    it('gives each filter instance its own portal ids', async () => {
      await TestBed.resetTestingModule()
        .configureTestingModule({ imports: [DatepickerRangeFilter] })
        .compileComponents();
      const otherFixture = TestBed.createComponent(DatepickerRangeFilter);
      const other = otherFixture.componentInstance;
      other.agInit(mockParams);

      expect(other.monthPopupPortalSelector).not.toBe(component.monthPopupPortalSelector);
      expect(other.yearPopupPortalSelector).not.toBe(component.yearPopupPortalSelector);
      other.ngOnDestroy();
    });

    it('removes both popup portal elements on destroy', () => {
      const monthSelector = component.monthPopupPortalSelector;
      const yearSelector = component.yearPopupPortalSelector;
      expect(document.querySelector(monthSelector)).not.toBeNull();
      expect(document.querySelector(yearSelector)).not.toBeNull();

      component.ngOnDestroy();

      expect(document.querySelector(monthSelector)).toBeNull();
      expect(document.querySelector(yearSelector)).toBeNull();
    });
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
      expect(component.doesFilterPass({ node: { data: { added_on: 1700000000 } } } as any)).toBe(
        true,
      );
    });

    it('should reject rows with no added_on when filter is applied', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      expect(component.doesFilterPass({ node: { data: {} } } as any)).toBe(false);
    });

    it('should match exact date when only appliedFrom is set', () => {
      const localMidnight = new Date(2024, 0, 15).getTime() / 1000;
      component.appliedFrom = new NgbDate(2024, 1, 15);
      component.appliedTo = null;
      expect(component.doesFilterPass({ node: { data: { added_on: localMidnight } } } as any)).toBe(
        true,
      );
    });

    it('should accept dates within the appliedFrom-appliedTo range', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      const midJan = new Date(2024, 0, 15).getTime() / 1000;
      expect(component.doesFilterPass({ node: { data: { added_on: midJan } } } as any)).toBe(true);
    });

    it('should reject dates outside the applied range', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      const beforeRange = new Date(2023, 11, 31).getTime() / 1000;
      expect(component.doesFilterPass({ node: { data: { added_on: beforeRange } } } as any)).toBe(
        false,
      );
    });

    it('should ignore a staged (unapplied) range', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      component.appliedFrom = null;
      component.appliedTo = null;
      const midJan = new Date(2024, 0, 15).getTime() / 1000;
      expect(component.doesFilterPass({ node: { data: { added_on: midJan } } } as any)).toBe(true);
    });

    it('should read the cell value via the configured getValue instead of a hardcoded field', () => {
      mockParams.getValue = vi.fn((node: { data: any }) => node.data?.last_activity);
      component.agInit(mockParams);
      component.appliedFrom = new NgbDate(2024, 1, 15);
      component.appliedTo = null;
      const localMidnight = new Date(2024, 0, 15).getTime() / 1000;

      expect(
        component.doesFilterPass({ node: { data: { last_activity: localMidnight } } } as any),
      ).toBe(true);
      expect(mockParams.getValue).toHaveBeenCalled();
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

  describe('date label rendering', () => {
    function getDateChips(): NodeListOf<Element> {
      return fixture.nativeElement.querySelectorAll('.bb-date-chip');
    }

    it('renders no date chips when nothing is selected', () => {
      component.fromDate = null;
      component.toDate = null;
      fixture.detectChanges();
      expect(getDateChips().length).toBe(0);
    });

    it('renders a single date chip when only fromDate is set', () => {
      component.fromDate = new NgbDate(2024, 3, 5);
      component.toDate = null;
      fixture.detectChanges();
      const chips = getDateChips();
      expect(chips.length).toBe(1);
      expect(chips[0].textContent).toBe('2024-03-05');
    });

    it('renders two date chips (from and to) when a range is set', () => {
      component.fromDate = new NgbDate(2024, 3, 5);
      component.toDate = new NgbDate(2024, 3, 20);
      fixture.detectChanges();
      const chips = getDateChips();
      expect(chips.length).toBe(2);
      expect(chips[0].textContent).toBe('2024-03-05');
      expect(chips[1].textContent).toBe('2024-03-20');
    });
  });

  describe('selectToday', () => {
    it('sets fromDate to today and clears toDate and hoveredDate', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 20);
      component.hoveredDate = new NgbDate(2024, 1, 15);
      const dp = { navigateTo: vi.fn() };

      component.selectToday(dp);

      expect(component.fromDate).toEqual(component.today);
      expect(component.toDate).toBeNull();
      expect(component.hoveredDate).toBeNull();
    });

    it('always resets to today even when nothing was previously selected', () => {
      component.fromDate = null;
      component.toDate = null;
      const dp = { navigateTo: vi.fn() };

      component.selectToday(dp);

      expect(component.fromDate).toEqual(component.today);
      expect(component.toDate).toBeNull();
    });

    it('updates viewDate to match today', () => {
      component.viewDate = { month: 1, year: 2020 };
      const dp = { navigateTo: vi.fn() };

      component.selectToday(dp);

      expect(component.viewDate).toEqual({
        month: component.today.month,
        year: component.today.year,
      });
    });

    it('navigates the calendar view to today', () => {
      const dp = { navigateTo: vi.fn() };

      component.selectToday(dp);

      expect(dp.navigateTo).toHaveBeenCalledWith(component.today);
    });

    it('does not call filterChangedCallback - selecting today only stages it', () => {
      const dp = { navigateTo: vi.fn() };

      component.selectToday(dp);

      expect(mockParams.filterChangedCallback).not.toHaveBeenCalled();
    });
  });

  describe('min/max date bounds', () => {
    async function createWithBounds(min: Date | null, max: Date | null) {
      const boundedParams: any = {
        filterChangedCallback: vi.fn(),
        api: { hidePopupMenu: vi.fn() },
        getValue: vi.fn(),
        getMinDate: () => min,
        getMaxDate: () => max,
      };

      await TestBed.resetTestingModule()
        .configureTestingModule({ imports: [DatepickerRangeFilter] })
        .compileComponents();

      const boundedFixture = TestBed.createComponent(DatepickerRangeFilter);
      const boundedComponent = boundedFixture.componentInstance;
      boundedComponent.agInit(boundedParams);
      boundedFixture.detectChanges();
      return boundedComponent;
    }

    describe('isOutOfRange', () => {
      it('has no bounds when getMinDate/getMaxDate are not provided', async () => {
        const c = await createWithBounds(null, null);
        expect(c.isOutOfRange(new NgbDate(1990, 1, 1))).toBe(false);
        expect(c.isOutOfRange(new NgbDate(2999, 1, 1))).toBe(false);
      });

      it('disables dates before the configured minimum', async () => {
        const c = await createWithBounds(new Date(2024, 0, 10), null);
        expect(c.isOutOfRange(new NgbDate(2024, 1, 9))).toBe(true);
      });

      it('disables dates after the configured maximum', async () => {
        const c = await createWithBounds(null, new Date(2024, 0, 20));
        expect(c.isOutOfRange(new NgbDate(2024, 1, 21))).toBe(true);
      });

      it('allows dates within the configured range', async () => {
        const c = await createWithBounds(new Date(2024, 0, 10), new Date(2024, 0, 20));
        expect(c.isOutOfRange(new NgbDate(2024, 1, 15))).toBe(false);
      });
    });

    describe('refreshing bounds on reopen', () => {
      it('recomputes minDate/maxDate from the latest getMinDate/getMaxDate each time the filter is reopened', async () => {
        let max: Date | null = new Date(2024, 0, 10);
        const boundedParams: any = {
          filterChangedCallback: vi.fn(),
          api: { hidePopupMenu: vi.fn() },
          getValue: vi.fn(),
          getMinDate: () => null,
          getMaxDate: () => max,
        };

        await TestBed.resetTestingModule()
          .configureTestingModule({ imports: [DatepickerRangeFilter] })
          .compileComponents();
        const boundedFixture = TestBed.createComponent(DatepickerRangeFilter);
        const c = boundedFixture.componentInstance;
        c.agInit(boundedParams);
        boundedFixture.detectChanges();

        expect(c.isOutOfRange(new NgbDate(2024, 1, 20))).toBe(true);

        max = new Date(2024, 0, 25);
        c.afterGuiAttached();

        expect(c.isOutOfRange(new NgbDate(2024, 1, 20))).toBe(false);
      });
    });

    describe('years dropdown', () => {
      it('is trimmed to the configured min/max year range', async () => {
        const c = await createWithBounds(new Date(2022, 0, 1), new Date(2025, 0, 1));
        expect(c.years).toEqual([2022, 2023, 2024, 2025]);
      });
    });

    describe('visibleMonths', () => {
      it('excludes months before the minimum month when viewing the minimum year', async () => {
        const c = await createWithBounds(new Date(2024, 2, 1), null); // min = March 2024
        c.viewDate = { month: 3, year: 2024 };
        const values = c.visibleMonths().map((m) => m.value);
        expect(values).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      });

      it('excludes months after the maximum month when viewing the maximum year', async () => {
        const c = await createWithBounds(null, new Date(2024, 5, 1)); // max = June 2024
        c.viewDate = { month: 6, year: 2024 };
        const values = c.visibleMonths().map((m) => m.value);
        expect(values).toEqual([1, 2, 3, 4, 5, 6]);
      });

      it('shows all months when the viewed year is neither the min nor max boundary year', async () => {
        const c = await createWithBounds(new Date(2024, 2, 1), new Date(2024, 5, 1));
        c.viewDate = { month: 1, year: 2023 };
        expect(c.visibleMonths().length).toBe(12);
      });

      it('returns the same array reference on repeated calls when the viewed year has not changed', () => {
        const first = component.visibleMonths();
        const second = component.visibleMonths();
        expect(second).toBe(first);
      });

      it('returns a new array reference once the viewed year changes', () => {
        const first = component.visibleMonths();
        component.viewDate = { ...component.viewDate, year: component.viewDate.year + 1 };
        const second = component.visibleMonths();
        expect(second).not.toBe(first);
      });
    });
  });
});
