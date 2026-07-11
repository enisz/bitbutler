import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SizeColumnFilter } from './size-column-filter';

describe('SizeColumnFilter', () => {
  let component: SizeColumnFilter;
  let fixture: ComponentFixture<SizeColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.size),
    };

    await TestBed.configureTestingModule({
      imports: [SizeColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(SizeColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter using MB as the default unit', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
    expect(component.applied.unit).toBe('MB');
  });

  it('exposes all 5 units', () => {
    expect(component.unitItems.map((u) => u.value)).toEqual(['B', 'KB', 'MB', 'GB', 'TB']);
  });

  describe('doesFilterPass', () => {
    it('passes everything when the filter is inactive', () => {
      expect(component.doesFilterPass({ node: { data: { size: 123 } } } as any)).toBe(true);
    });

    it('scales the applied "from" by the selected unit before comparing raw bytes', () => {
      component.applied = { operator: 'gte', from: 1, to: null, unit: 'MB' };
      expect(component.doesFilterPass({ node: { data: { size: 1024 * 1024 } } } as any)).toBe(true);
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { size: 1024 * 1024 - 1 } } } as any)).toBe(
        false,
      );
    });

    it('applies GB scaling for between', () => {
      component.applied = { operator: 'between', from: 1, to: 2, unit: 'GB' };
      const oneGb = 1024 ** 3;
      expect(component.doesFilterPass({ node: { data: { size: oneGb } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { size: 2 * oneGb } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { size: 2 * oneGb + 1 } } } as any)).toBe(
        false,
      );
    });

    it('B unit does not scale the value', () => {
      component.applied = { operator: 'equals', from: 512, to: null, unit: 'B' };
      expect(component.doesFilterPass({ node: { data: { size: 512 } } } as any)).toBe(true);
    });
  });

  describe('getModel / setModel', () => {
    it('round-trips the unit alongside operator/from/to', () => {
      component.setModel({ operator: 'lte', from: 5, to: null, unit: 'TB' });
      expect(component.applied).toEqual({ operator: 'lte', from: 5, to: null, unit: 'TB' });
      expect(component.getModel()).toEqual({ operator: 'lte', from: 5, to: null, unit: 'TB' });
    });

    it('resets to the default (MB) unit when the model is null', () => {
      component.applied = { operator: 'lte', from: 5, to: null, unit: 'TB' };
      component.setModel(null);
      expect(component.applied.unit).toBe('MB');
    });

    it('falls back to an empty value for a shape-invalid (stale) model instead of throwing', () => {
      component.applied = { operator: 'lte', from: 5, to: null, unit: 'TB' };
      expect(() =>
        component.setModel({ filterType: 'number', type: 'equals', filter: 5 } as any),
      ).not.toThrow();
      expect(component.applied).toEqual({ operator: 'equals', from: null, to: null, unit: 'MB' });
    });

    it('falls back to an empty value when unit is not a known size unit', () => {
      component.setModel({ operator: 'equals', from: 5, to: null, unit: 'PB' } as any);
      expect(component.applied).toEqual({ operator: 'equals', from: null, to: null, unit: 'MB' });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft (including unit) into applied and calls filterChangedCallback', () => {
      component.draft = { operator: 'gt', from: 5, to: null, unit: 'GB' };
      component.apply();
      expect(component.applied).toEqual({ operator: 'gt', from: 5, to: null, unit: 'GB' });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is disabled for an incomplete "between" (only "from" filled) with nothing applied', () => {
      component.applied = { operator: 'equals', from: null, to: null, unit: 'MB' };
      component.draft = { operator: 'between', from: 1, to: null, unit: 'MB' };
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is enabled once both "from" and "to" are filled for "between"', () => {
      component.applied = { operator: 'equals', from: null, to: null, unit: 'MB' };
      component.draft = { operator: 'between', from: 1, to: 2, unit: 'MB' };
      expect(component.isApplyDisabled()).toBe(false);
    });

    it('is enabled when clearing a real applied filter down to an empty draft', () => {
      component.applied = { operator: 'gt', from: 5, to: null, unit: 'GB' };
      component.draft = { operator: 'equals', from: null, to: null, unit: 'MB' };
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});
