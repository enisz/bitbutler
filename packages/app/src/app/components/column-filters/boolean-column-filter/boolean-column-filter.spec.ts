import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BooleanColumnFilter } from './boolean-column-filter';

describe('BooleanColumnFilter', () => {
  let component: BooleanColumnFilter;
  let fixture: ComponentFixture<BooleanColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      api: { hidePopupMenu: vi.fn() },
      getValue: vi.fn((node: { data: any }) => node.data?.auto_tmm),
    };

    await TestBed.configureTestingModule({
      imports: [BooleanColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(BooleanColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
  });

  it('exposes true/false value items, translated', () => {
    expect(component.valueItems()).toEqual([
      { value: true, label: expect.any(String) },
      { value: false, label: expect.any(String) },
    ]);
  });

  describe('doesFilterPass', () => {
    it('passes everything when the filter is inactive', () => {
      expect(component.doesFilterPass({ node: { data: { auto_tmm: true } } } as any)).toBe(true);
    });

    it('matches only rows equal to the applied true value', () => {
      component.applied = { value: true };
      expect(component.doesFilterPass({ node: { data: { auto_tmm: true } } } as any)).toBe(true);
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { auto_tmm: false } } } as any)).toBe(false);
    });

    it('matches only rows equal to the applied false value', () => {
      component.applied = { value: false };
      expect(component.doesFilterPass({ node: { data: { auto_tmm: false } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { auto_tmm: true } } } as any)).toBe(false);
    });

    it('excludes rows where the field is undefined', () => {
      component.applied = { value: true };
      expect(component.doesFilterPass({ node: { data: {} } } as any)).toBe(false);
    });
  });

  describe('isActive', () => {
    it('is inactive when value is null', () => {
      expect(component.isActive({ value: null })).toBe(false);
    });

    it('is active for both true and false', () => {
      expect(component.isActive({ value: true })).toBe(true);
      expect(component.isActive({ value: false })).toBe(true);
    });
  });

  describe('getModel / setModel', () => {
    it('returns null when the filter is inactive', () => {
      expect(component.getModel()).toBeNull();
    });

    it('restores both draft and applied from a model', () => {
      component.setModel({ value: false });
      expect(component.applied).toEqual({ value: false });
      expect(component.draft).toEqual({ value: false });
    });

    it('resets to an empty value when the model is null', () => {
      component.applied = { value: true };
      component.setModel(null);
      expect(component.applied).toEqual({ value: null });
    });

    it('falls back to an empty value for a shape-invalid (stale) model instead of throwing', () => {
      component.applied = { value: true };
      expect(() => component.setModel({ value: 'yes' } as any)).not.toThrow();
      expect(component.applied).toEqual({ value: null });
      expect(component.draft).toEqual({ value: null });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft into applied and calls filterChangedCallback', () => {
      component.draft = { value: true };
      component.apply();
      expect(component.applied).toEqual({ value: true });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });

    it('clear resets both draft and applied and calls filterChangedCallback', () => {
      component.applied = { value: true };
      component.draft = { value: true };
      component.clear();
      expect(component.applied).toEqual({ value: null });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is disabled when draft equals applied', () => {
      component.applied = { value: true };
      component.draft = { value: true };
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is enabled when draft differs from applied', () => {
      component.applied = { value: null };
      component.draft = { value: false };
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});
