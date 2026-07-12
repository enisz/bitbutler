import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DurationColumnFilter } from './duration-column-filter';

describe('DurationColumnFilter', () => {
  let component: DurationColumnFilter;
  let fixture: ComponentFixture<DurationColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.seeding_time),
    };

    await TestBed.configureTestingModule({
      imports: [DurationColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(DurationColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter using minutes as the default unit', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
    expect(component.applied.unit).toBe('minutes');
  });

  it('exposes all 7 units', () => {
    expect(component.unitItems().map((u) => u.value)).toEqual([
      'seconds',
      'minutes',
      'hours',
      'days',
      'weeks',
      'months',
      'years',
    ]);
  });

  describe('doesFilterPass', () => {
    it('passes everything when the filter is inactive', () => {
      expect(component.doesFilterPass({ node: { data: { seeding_time: 123 } } } as any)).toBe(true);
    });

    it('scales the applied "from" by the selected unit before comparing raw seconds', () => {
      component.applied = { operator: 'gte', from: 1, to: null, unit: 'hours' };
      expect(component.doesFilterPass({ node: { data: { seeding_time: 3600 } } } as any)).toBe(
        true,
      );
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { seeding_time: 3599 } } } as any)).toBe(
        false,
      );
    });

    it('applies days scaling for between', () => {
      component.applied = { operator: 'between', from: 1, to: 2, unit: 'days' };
      const oneDay = 86400;
      expect(component.doesFilterPass({ node: { data: { seeding_time: oneDay } } } as any)).toBe(
        true,
      );
      expect(
        component.doesFilterPass({ node: { data: { seeding_time: 2 * oneDay } } } as any),
      ).toBe(true);
      expect(
        component.doesFilterPass({ node: { data: { seeding_time: 2 * oneDay + 1 } } } as any),
      ).toBe(false);
    });

    it('seconds unit does not scale the value', () => {
      component.applied = { operator: 'equals', from: 512, to: null, unit: 'seconds' };
      expect(component.doesFilterPass({ node: { data: { seeding_time: 512 } } } as any)).toBe(true);
    });
  });

  describe('getModel / setModel', () => {
    it('round-trips the unit alongside operator/from/to', () => {
      component.setModel({ operator: 'lte', from: 5, to: null, unit: 'years' });
      expect(component.applied).toEqual({ operator: 'lte', from: 5, to: null, unit: 'years' });
      expect(component.getModel()).toEqual({ operator: 'lte', from: 5, to: null, unit: 'years' });
    });

    it('resets to the default (minutes) unit when the model is null', () => {
      component.applied = { operator: 'lte', from: 5, to: null, unit: 'years' };
      component.setModel(null);
      expect(component.applied.unit).toBe('minutes');
    });

    it('falls back to an empty value for a shape-invalid (stale) model instead of throwing', () => {
      component.applied = { operator: 'lte', from: 5, to: null, unit: 'years' };
      expect(() =>
        component.setModel({ filterType: 'number', type: 'equals', filter: 5 } as any),
      ).not.toThrow();
      expect(component.applied).toEqual({
        operator: 'equals',
        from: null,
        to: null,
        unit: 'minutes',
      });
    });

    it('falls back to an empty value when unit is not a known time unit', () => {
      component.setModel({ operator: 'equals', from: 5, to: null, unit: 'decades' } as any);
      expect(component.applied).toEqual({
        operator: 'equals',
        from: null,
        to: null,
        unit: 'minutes',
      });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft (including unit) into applied and calls filterChangedCallback', () => {
      component.draft = { operator: 'gt', from: 5, to: null, unit: 'days' };
      component.apply();
      expect(component.applied).toEqual({ operator: 'gt', from: 5, to: null, unit: 'days' });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is disabled for an incomplete "between" (only "from" filled) with nothing applied', () => {
      component.applied = { operator: 'equals', from: null, to: null, unit: 'minutes' };
      component.draft = { operator: 'between', from: 1, to: null, unit: 'minutes' };
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is enabled once both "from" and "to" are filled for "between"', () => {
      component.applied = { operator: 'equals', from: null, to: null, unit: 'minutes' };
      component.draft = { operator: 'between', from: 1, to: 2, unit: 'minutes' };
      expect(component.isApplyDisabled()).toBe(false);
    });

    it('is enabled when clearing a real applied filter down to an empty draft', () => {
      component.applied = { operator: 'gt', from: 5, to: null, unit: 'days' };
      component.draft = { operator: 'equals', from: null, to: null, unit: 'minutes' };
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});
