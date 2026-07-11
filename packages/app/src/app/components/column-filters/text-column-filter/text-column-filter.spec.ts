import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextColumnFilter } from './text-column-filter';

describe('TextColumnFilter', () => {
  let component: TextColumnFilter;
  let fixture: ComponentFixture<TextColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.name),
    };

    await TestBed.configureTestingModule({
      imports: [TextColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(TextColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
  });

  it('exposes all 8 string operators, translated', () => {
    expect(component.operatorItems()).toHaveLength(8);
    expect(component.operatorItems().map((o) => o.value)).toEqual([
      'contains',
      'notContains',
      'equals',
      'notEqual',
      'startsWith',
      'endsWith',
      'blank',
      'notBlank',
    ]);
  });

  describe('doesFilterPass', () => {
    it('passes everything when the filter is inactive', () => {
      expect(component.doesFilterPass({ node: { data: { name: 'anything' } } } as any)).toBe(true);
    });

    it('applies the contains operator against the applied value using getValue', () => {
      component.applied = { operator: 'contains', value: 'ubuntu' };
      expect(component.doesFilterPass({ node: { data: { name: 'Ubuntu 24.04' } } } as any)).toBe(
        true,
      );
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { name: 'Fedora' } } } as any)).toBe(false);
    });

    it('blank ignores the applied value and only checks the cell', () => {
      component.applied = { operator: 'blank', value: 'ignored' };
      expect(component.doesFilterPass({ node: { data: { name: '' } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { name: 'x' } } } as any)).toBe(false);
    });
  });

  describe('isValueDisabled', () => {
    it('disables the value input for blank and not-blank operators', () => {
      component.draft = { operator: 'blank', value: '' };
      expect(component.isValueDisabled()).toBe(true);
      component.draft = { operator: 'notBlank', value: '' };
      expect(component.isValueDisabled()).toBe(true);
      component.draft = { operator: 'contains', value: '' };
      expect(component.isValueDisabled()).toBe(false);
    });
  });

  describe('getModel / setModel', () => {
    it('returns null when the filter is inactive', () => {
      expect(component.getModel()).toBeNull();
    });

    it('returns the applied model once a value is set', () => {
      component.applied = { operator: 'equals', value: 'x' };
      expect(component.getModel()).toEqual({ operator: 'equals', value: 'x' });
    });

    it('restores both draft and applied from a model', () => {
      component.setModel({ operator: 'startsWith', value: 'ubu' });
      expect(component.applied).toEqual({ operator: 'startsWith', value: 'ubu' });
      expect(component.draft).toEqual({ operator: 'startsWith', value: 'ubu' });
    });

    it('resets to an empty value when the model is null', () => {
      component.applied = { operator: 'equals', value: 'x' };
      component.setModel(null);
      expect(component.applied).toEqual({ operator: 'contains', value: '' });
      expect(component.draft).toEqual({ operator: 'contains', value: '' });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft into applied and calls filterChangedCallback', () => {
      component.draft = { operator: 'equals', value: 'x' };
      component.apply();
      expect(component.applied).toEqual({ operator: 'equals', value: 'x' });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });

    it('clear resets both draft and applied and calls filterChangedCallback', () => {
      component.applied = { operator: 'equals', value: 'x' };
      component.draft = { operator: 'equals', value: 'x' };
      component.clear();
      expect(component.applied).toEqual({ operator: 'contains', value: '' });
      expect(component.draft).toEqual({ operator: 'contains', value: '' });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is true when draft matches applied', () => {
      component.draft = { operator: 'contains', value: '' };
      component.applied = { operator: 'contains', value: '' };
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is false when draft differs from applied', () => {
      component.draft = { operator: 'contains', value: 'x' };
      component.applied = { operator: 'contains', value: '' };
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});
