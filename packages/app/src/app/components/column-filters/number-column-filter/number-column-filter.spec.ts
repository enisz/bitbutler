import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberColumnFilter } from './number-column-filter';

describe('NumberColumnFilter', () => {
  let component: NumberColumnFilter;
  let fixture: ComponentFixture<NumberColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.ratio),
    };

    await TestBed.configureTestingModule({
      imports: [NumberColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(NumberColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
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
      expect(component.doesFilterPass({ node: { data: { ratio: 1.5 } } } as any)).toBe(true);
    });

    it('applies gte against the applied "from" using getValue', () => {
      component.applied = { operator: 'gte', from: 1, to: null };
      expect(component.doesFilterPass({ node: { data: { ratio: 1 } } } as any)).toBe(true);
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { ratio: 0.5 } } } as any)).toBe(false);
    });

    it('between is inclusive on both ends', () => {
      component.applied = { operator: 'between', from: 1, to: 2 };
      expect(component.doesFilterPass({ node: { data: { ratio: 1 } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { ratio: 2 } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { ratio: 2.1 } } } as any)).toBe(false);
    });
  });

  describe('isActive', () => {
    it('is active for blank/notBlank regardless of from/to', () => {
      expect(component.isActive({ operator: 'blank', from: null, to: null })).toBe(true);
      expect(component.isActive({ operator: 'notBlank', from: null, to: null })).toBe(true);
    });

    it('requires "from" for single-value operators', () => {
      expect(component.isActive({ operator: 'gt', from: null, to: null })).toBe(false);
      expect(component.isActive({ operator: 'gt', from: 1, to: null })).toBe(true);
    });

    it('requires both "from" and "to" for between', () => {
      expect(component.isActive({ operator: 'between', from: 1, to: null })).toBe(false);
      expect(component.isActive({ operator: 'between', from: 1, to: 2 })).toBe(true);
    });
  });

  describe('isInputDisabled', () => {
    it('disables the value inputs for blank and not-blank operators', () => {
      component.draft = { operator: 'blank', from: null, to: null };
      expect(component.isInputDisabled()).toBe(true);
      component.draft = { operator: 'equals', from: null, to: null };
      expect(component.isInputDisabled()).toBe(false);
    });
  });

  describe('getModel / setModel', () => {
    it('returns null when the filter is inactive', () => {
      expect(component.getModel()).toBeNull();
    });

    it('restores both draft and applied from a model', () => {
      component.setModel({ operator: 'between', from: 1, to: 2 });
      expect(component.applied).toEqual({ operator: 'between', from: 1, to: 2 });
      expect(component.draft).toEqual({ operator: 'between', from: 1, to: 2 });
    });

    it('resets to an empty value when the model is null', () => {
      component.applied = { operator: 'gt', from: 1, to: null };
      component.setModel(null);
      expect(component.applied).toEqual({ operator: 'equals', from: null, to: null });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft into applied and calls filterChangedCallback', () => {
      component.draft = { operator: 'gt', from: 5, to: null };
      component.apply();
      expect(component.applied).toEqual({ operator: 'gt', from: 5, to: null });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });

    it('clear resets both draft and applied and calls filterChangedCallback', () => {
      component.applied = { operator: 'gt', from: 5, to: null };
      component.draft = { operator: 'gt', from: 5, to: null };
      component.clear();
      expect(component.applied).toEqual({ operator: 'equals', from: null, to: null });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });
});
