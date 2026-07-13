import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RatioLimitColumnFilter } from './ratio-limit-column-filter';

describe('RatioLimitColumnFilter', () => {
  let component: RatioLimitColumnFilter;
  let fixture: ComponentFixture<RatioLimitColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      api: { hidePopupMenu: vi.fn() },
      getValue: vi.fn((node: { data: any }) => node.data?.ratio_limit),
    };

    await TestBed.configureTestingModule({
      imports: [RatioLimitColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(RatioLimitColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter using custom mode', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
    expect(component.applied.mode).toBe('custom');
  });

  it('exposes noLimit/global/custom modes', () => {
    expect(component.modeItems().map((m) => m.value)).toEqual(['noLimit', 'global', 'custom']);
  });

  it('exposes all 9 number operators, translated', () => {
    expect(component.operatorItems()).toHaveLength(9);
    expect(component.operatorItems().map((o) => o.value)).toEqual([
      'equals',
      'notEqual',
      'gt',
      'gte',
      'lt',
      'lte',
      'between',
      'blank',
      'notBlank',
    ]);
  });

  describe('doesFilterPass', () => {
    it('passes everything when the filter is inactive', () => {
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 2 } } } as any)).toBe(true);
    });

    it('noLimit mode matches only -1', () => {
      component.applied = { mode: 'noLimit', operator: 'equals', from: null, to: null };
      expect(component.doesFilterPass({ node: { data: { ratio_limit: -1 } } } as any)).toBe(true);
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { ratio_limit: -2 } } } as any)).toBe(false);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 2 } } } as any)).toBe(false);
    });

    it('global mode matches only -2', () => {
      component.applied = { mode: 'global', operator: 'equals', from: null, to: null };
      expect(component.doesFilterPass({ node: { data: { ratio_limit: -2 } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: -1 } } } as any)).toBe(false);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 2 } } } as any)).toBe(false);
    });

    it('custom mode compares the raw value directly against "from" (no unit scaling)', () => {
      component.applied = { mode: 'custom', operator: 'gte', from: 2, to: null };
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 2 } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 1.9 } } } as any)).toBe(false);
    });

    it('custom mode never matches the -1/-2 sentinel values', () => {
      component.applied = { mode: 'custom', operator: 'lt', from: 1000, to: null };
      expect(component.doesFilterPass({ node: { data: { ratio_limit: -1 } } } as any)).toBe(false);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: -2 } } } as any)).toBe(false);
    });

    it('applies between in custom mode inclusively', () => {
      component.applied = { mode: 'custom', operator: 'between', from: 1, to: 2 };
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 1 } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 2 } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 2.1 } } } as any)).toBe(false);
    });
  });

  describe('isActive', () => {
    it('is active for noLimit and global modes regardless of operator/value', () => {
      expect(
        component.isActive({ mode: 'noLimit', operator: 'equals', from: null, to: null }),
      ).toBe(true);
      expect(component.isActive({ mode: 'global', operator: 'equals', from: null, to: null })).toBe(
        true,
      );
    });

    it('follows the from/to completeness rule in custom mode', () => {
      expect(component.isActive({ mode: 'custom', operator: 'equals', from: null, to: null })).toBe(
        false,
      );
      expect(component.isActive({ mode: 'custom', operator: 'equals', from: 5, to: null })).toBe(
        true,
      );
    });
  });

  describe('getModel / setModel', () => {
    it('round-trips the mode alongside operator/from/to', () => {
      component.setModel({ mode: 'noLimit', operator: 'lte', from: 5, to: null });
      expect(component.applied).toEqual({ mode: 'noLimit', operator: 'lte', from: 5, to: null });
      expect(component.getModel()).toEqual({
        mode: 'noLimit',
        operator: 'lte',
        from: 5,
        to: null,
      });
    });

    it('resets to the default (custom) when the model is null', () => {
      component.applied = { mode: 'noLimit', operator: 'lte', from: 5, to: null };
      component.setModel(null);
      expect(component.applied.mode).toBe('custom');
    });

    it('falls back to an empty value for a shape-invalid (stale) model instead of throwing', () => {
      component.applied = { mode: 'noLimit', operator: 'lte', from: 5, to: null };
      expect(() =>
        component.setModel({ filterType: 'number', type: 'equals', filter: 5 } as any),
      ).not.toThrow();
      expect(component.applied).toEqual({
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
      });
    });

    it('falls back to an empty value when mode is not one of the 3 allowed values', () => {
      component.setModel({ mode: 'unlimited', operator: 'equals', from: 5, to: null } as any);
      expect(component.applied).toEqual({
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
      });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft (including mode) into applied and calls filterChangedCallback', () => {
      component.draft = { mode: 'global', operator: 'equals', from: null, to: null };
      component.apply();
      expect(component.applied).toEqual({
        mode: 'global',
        operator: 'equals',
        from: null,
        to: null,
      });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is disabled for an incomplete "between" (only "from" filled) with nothing applied', () => {
      component.applied = { mode: 'custom', operator: 'equals', from: null, to: null };
      component.draft = { mode: 'custom', operator: 'between', from: 1, to: null };
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is enabled once both "from" and "to" are filled for "between"', () => {
      component.applied = { mode: 'custom', operator: 'equals', from: null, to: null };
      component.draft = { mode: 'custom', operator: 'between', from: 1, to: 2 };
      expect(component.isApplyDisabled()).toBe(false);
    });

    it('is enabled when switching from custom to noLimit', () => {
      component.applied = { mode: 'custom', operator: 'equals', from: null, to: null };
      component.draft = { mode: 'noLimit', operator: 'equals', from: null, to: null };
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});
