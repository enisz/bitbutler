import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SetColumnFilter, buildValueCounts } from './set-column-filter';

describe('SetColumnFilter', () => {
  let component: SetColumnFilter;
  let fixture: ComponentFixture<SetColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      getItems: vi.fn().mockReturnValue([
        { key: 'Movies', label: 'Movies', count: 3 },
        { key: 'Books', label: 'Books', count: 1 },
      ]),
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.category),
    };

    await TestBed.configureTestingModule({
      imports: [SetColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(SetColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
  });

  it('reads its item list from getItems', () => {
    expect(component.items()).toEqual([
      { key: 'Movies', label: 'Movies', count: 3 },
      { key: 'Books', label: 'Books', count: 1 },
    ]);
  });

  describe('toggle', () => {
    it('adds and removes keys from draftValues', () => {
      component.toggle('Movies');
      expect(component.draftValues.has('Movies')).toBe(true);
      component.toggle('Movies');
      expect(component.draftValues.has('Movies')).toBe(false);
    });
  });

  describe('doesFilterPass', () => {
    it('passes everything when no values are applied', () => {
      expect(component.doesFilterPass({ node: { data: { category: 'Movies' } } } as any)).toBe(
        true,
      );
    });

    it('matches an exact selected value using getValue', () => {
      component.appliedValues = new Set(['Movies']);
      expect(component.doesFilterPass({ node: { data: { category: 'Movies' } } } as any)).toBe(
        true,
      );
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { category: 'Books' } } } as any)).toBe(
        false,
      );
    });

    it('matches multi-value cells by overlap when getValues is provided', () => {
      mockParams.getValues = (cellValue: unknown) =>
        String(cellValue ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      mockParams.getValue = vi.fn((node: { data: any }) => node.data?.tags);
      component.agInit(mockParams);
      component.appliedValues = new Set(['hd']);
      expect(component.doesFilterPass({ node: { data: { tags: 'hd, 4k' } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { tags: '4k' } } } as any)).toBe(false);
    });
  });

  describe('getModel / setModel', () => {
    it('returns null when nothing is applied', () => {
      expect(component.getModel()).toBeNull();
    });

    it('round-trips applied values through get/setModel', () => {
      component.setModel({ values: ['Movies', 'Books'] });
      expect(component.appliedValues).toEqual(new Set(['Movies', 'Books']));
      expect(component.draftValues).toEqual(new Set(['Movies', 'Books']));
      expect(component.getModel()).toEqual({ values: ['Movies', 'Books'] });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draftValues into appliedValues and calls filterChangedCallback', () => {
      component.toggle('Movies');
      component.apply();
      expect(component.appliedValues).toEqual(new Set(['Movies']));
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });

    it('clear resets both draftValues and appliedValues and calls filterChangedCallback', () => {
      component.appliedValues = new Set(['Movies']);
      component.draftValues = new Set(['Movies']);
      component.clear();
      expect(component.appliedValues.size).toBe(0);
      expect(component.draftValues.size).toBe(0);
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is true when draftValues matches appliedValues', () => {
      component.draftValues = new Set(['Movies']);
      component.appliedValues = new Set(['Movies']);
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is false when draftValues differs from appliedValues', () => {
      component.draftValues = new Set(['Movies', 'Books']);
      component.appliedValues = new Set(['Movies']);
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});

describe('buildValueCounts', () => {
  it('tallies and sorts distinct values by label', () => {
    const rows = [{ country: 'US' }, { country: 'DE' }, { country: 'US' }, { country: undefined }];
    expect(buildValueCounts(rows, (r) => r.country)).toEqual([
      { key: 'DE', label: 'DE', count: 1 },
      { key: 'US', label: 'US', count: 2 },
    ]);
  });

  it('excludes null/undefined/empty values', () => {
    const rows = [{ v: '' }, { v: null }, { v: undefined }];
    expect(buildValueCounts(rows, (r: any) => r.v)).toEqual([]);
  });
});
