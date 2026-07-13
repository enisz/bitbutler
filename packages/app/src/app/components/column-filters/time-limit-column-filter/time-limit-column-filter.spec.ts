import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeLimitColumnFilter } from './time-limit-column-filter';

describe('TimeLimitColumnFilter', () => {
  let component: TimeLimitColumnFilter;
  let fixture: ComponentFixture<TimeLimitColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      api: { hidePopupMenu: vi.fn() },
      getValue: vi.fn((node: { data: any }) => node.data?.seeding_time_limit),
    };

    await TestBed.configureTestingModule({
      imports: [TimeLimitColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(TimeLimitColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter using custom mode and hours as the default unit', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
    expect(component.applied.mode).toBe('custom');
    expect(component.applied.unit).toBe('hours');
  });

  it('exposes 6 units, excluding seconds', () => {
    expect(component.unitItems().map((u) => u.value)).toEqual([
      'minutes',
      'hours',
      'days',
      'weeks',
      'months',
      'years',
    ]);
  });

  it('exposes noLimit/global/custom modes', () => {
    expect(component.modeItems().map((m) => m.value)).toEqual(['noLimit', 'global', 'custom']);
  });

  describe('doesFilterPass', () => {
    it('passes everything when the filter is inactive', () => {
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: 60 } } } as any)).toBe(
        true,
      );
    });

    it('noLimit mode matches only -1', () => {
      component.applied = {
        mode: 'noLimit',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      };
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: -1 } } } as any)).toBe(
        true,
      );
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: -2 } } } as any)).toBe(
        false,
      );
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: 60 } } } as any)).toBe(
        false,
      );
    });

    it('global mode matches only -2', () => {
      component.applied = {
        mode: 'global',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      };
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: -2 } } } as any)).toBe(
        true,
      );
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: -1 } } } as any)).toBe(
        false,
      );
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: 60 } } } as any)).toBe(
        false,
      );
    });

    it('custom mode scales the applied "from" by the selected unit before comparing raw minutes', () => {
      component.applied = { mode: 'custom', operator: 'gte', from: 1, to: null, unit: 'hours' };
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: 60 } } } as any)).toBe(
        true,
      );
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: 59 } } } as any)).toBe(
        false,
      );
    });

    it('custom mode never matches the -1/-2 sentinel values', () => {
      component.applied = {
        mode: 'custom',
        operator: 'lt',
        from: 1000,
        to: null,
        unit: 'minutes',
      };
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: -1 } } } as any)).toBe(
        false,
      );
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: -2 } } } as any)).toBe(
        false,
      );
    });

    it('applies days scaling for between in custom mode', () => {
      component.applied = { mode: 'custom', operator: 'between', from: 1, to: 2, unit: 'days' };
      expect(
        component.doesFilterPass({ node: { data: { seeding_time_limit: 1440 } } } as any),
      ).toBe(true);
      expect(
        component.doesFilterPass({ node: { data: { seeding_time_limit: 2880 } } } as any),
      ).toBe(true);
      expect(
        component.doesFilterPass({ node: { data: { seeding_time_limit: 2881 } } } as any),
      ).toBe(false);
    });
  });

  describe('isActive', () => {
    it('is active for noLimit and global modes regardless of operator/value', () => {
      expect(
        component.isActive({
          mode: 'noLimit',
          operator: 'equals',
          from: null,
          to: null,
          unit: 'hours',
        }),
      ).toBe(true);
      expect(
        component.isActive({
          mode: 'global',
          operator: 'equals',
          from: null,
          to: null,
          unit: 'hours',
        }),
      ).toBe(true);
    });

    it('follows the from/to completeness rule in custom mode', () => {
      expect(
        component.isActive({
          mode: 'custom',
          operator: 'equals',
          from: null,
          to: null,
          unit: 'hours',
        }),
      ).toBe(false);
      expect(
        component.isActive({
          mode: 'custom',
          operator: 'equals',
          from: 5,
          to: null,
          unit: 'hours',
        }),
      ).toBe(true);
    });
  });

  describe('getModel / setModel', () => {
    it('round-trips the mode and unit alongside operator/from/to', () => {
      component.setModel({ mode: 'noLimit', operator: 'lte', from: 5, to: null, unit: 'years' });
      expect(component.applied).toEqual({
        mode: 'noLimit',
        operator: 'lte',
        from: 5,
        to: null,
        unit: 'years',
      });
      expect(component.getModel()).toEqual({
        mode: 'noLimit',
        operator: 'lte',
        from: 5,
        to: null,
        unit: 'years',
      });
    });

    it('resets to the default (custom/hours) when the model is null', () => {
      component.applied = { mode: 'noLimit', operator: 'lte', from: 5, to: null, unit: 'years' };
      component.setModel(null);
      expect(component.applied.mode).toBe('custom');
      expect(component.applied.unit).toBe('hours');
    });

    it('falls back to an empty value for a shape-invalid (stale) model instead of throwing', () => {
      component.applied = { mode: 'noLimit', operator: 'lte', from: 5, to: null, unit: 'years' };
      expect(() =>
        component.setModel({ filterType: 'number', type: 'equals', filter: 5 } as any),
      ).not.toThrow();
      expect(component.applied).toEqual({
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      });
    });

    it('falls back to an empty value when unit is seconds (not allowed for this filter)', () => {
      component.setModel({
        mode: 'custom',
        operator: 'equals',
        from: 5,
        to: null,
        unit: 'seconds',
      } as any);
      expect(component.applied).toEqual({
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft (including mode and unit) into applied and calls filterChangedCallback', () => {
      component.draft = { mode: 'global', operator: 'equals', from: null, to: null, unit: 'hours' };
      component.apply();
      expect(component.applied).toEqual({
        mode: 'global',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is disabled for an incomplete "between" (only "from" filled) with nothing applied', () => {
      component.applied = {
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      };
      component.draft = { mode: 'custom', operator: 'between', from: 1, to: null, unit: 'hours' };
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is enabled once both "from" and "to" are filled for "between"', () => {
      component.applied = {
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      };
      component.draft = { mode: 'custom', operator: 'between', from: 1, to: 2, unit: 'hours' };
      expect(component.isApplyDisabled()).toBe(false);
    });

    it('is enabled when switching from custom to noLimit', () => {
      component.applied = {
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      };
      component.draft = {
        mode: 'noLimit',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      };
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});
