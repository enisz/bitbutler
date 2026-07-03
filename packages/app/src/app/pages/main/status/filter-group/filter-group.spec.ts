import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterGroupComponent, FilterItem } from './filter-group';

const sampleItems: FilterItem[] = [
  { key: 'all', label: 'All', count: 10 },
  { key: 'downloading', label: 'Downloading', count: 3 },
  { key: 'seeding', label: 'Seeding', count: 7 },
];

describe('FilterGroupComponent', () => {
  let component: FilterGroupComponent;
  let fixture: ComponentFixture<FilterGroupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterGroupComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterGroupComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Status');
    fixture.componentRef.setInput('activeKey', 'all');
    fixture.componentRef.setInput('showAllCount', 10);
    fixture.componentRef.setInput('items', sampleItems);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('items input', () => {
    it('should reflect items set via signal input', () => {
      fixture.componentRef.setInput('items', sampleItems);
      expect(component.items()).toBe(sampleItems);
    });

    it('should treat null items as empty array in filteredItems', () => {
      fixture.componentRef.setInput('items', null);
      expect(component.filteredItems()).toEqual([]);
    });
  });

  describe('auto-emit on item removal', () => {
    it('should emit "all" when active item is removed from items list', () => {
      const emitted: string[] = [];
      component.itemSelected.subscribe((key) => emitted.push(key));

      fixture.componentRef.setInput('activeKey', 'downloading');
      fixture.componentRef.setInput('items', [{ key: 'seeding', label: 'Seeding', count: 7 }]);
      fixture.detectChanges();

      expect(emitted).toContain('all');
    });

    it('should not emit when active item is still in the updated list', () => {
      const emitted: string[] = [];
      component.itemSelected.subscribe((key) => emitted.push(key));

      fixture.componentRef.setInput('activeKey', 'downloading');
      fixture.componentRef.setInput('items', [...sampleItems]);
      fixture.detectChanges();

      expect(emitted).toHaveLength(0);
    });

    it('should not emit when activeKey is "all"', () => {
      const emitted: string[] = [];
      component.itemSelected.subscribe((key) => emitted.push(key));

      fixture.componentRef.setInput('activeKey', 'all');
      fixture.componentRef.setInput('items', []);
      fixture.detectChanges();

      expect(emitted).toHaveLength(0);
    });
  });

  describe('clearFilter', () => {
    it('should reset the filter control to empty string', () => {
      component.filterCtrl.setValue('test');
      component.clearFilter();
      expect(component.filterCtrl.value).toBe('');
    });
  });

  describe('onItemSelected', () => {
    it('should emit the selected key', () => {
      const emitted: string[] = [];
      component.itemSelected.subscribe((key) => emitted.push(key));
      component.onItemSelected('downloading');
      expect(emitted).toEqual(['downloading']);
    });
  });

  describe('isIconArray', () => {
    it('should return true for an array of icons', () => {
      const iconArray = [{} as any, {} as any];
      expect(component.isIconArray(iconArray)).toBe(true);
    });

    it('should return false for a single icon', () => {
      const singleIcon = {} as any;
      expect(component.isIconArray(singleIcon)).toBe(false);
    });
  });

  describe('item badge variant', () => {
    it('should apply the neutral badge class when an item has no variant', () => {
      fixture.componentRef.setInput('items', [{ key: 'a', label: 'A', count: 1 }]);
      fixture.detectChanges();
      const badge: HTMLElement = fixture.nativeElement.querySelector('.bb-status-badge');
      expect(badge.classList.contains('bb-status-badge--neutral')).toBe(true);
      expect(badge.classList.contains('text-bg-success')).toBe(false);
    });

    it('should apply a text-bg-{variant} class when an item has a variant', () => {
      fixture.componentRef.setInput('items', [
        { key: 'a', label: 'A', count: 1, variant: 'success' },
      ]);
      fixture.detectChanges();
      const badge: HTMLElement = fixture.nativeElement.querySelector('.bb-status-badge');
      expect(badge.classList.contains('text-bg-success')).toBe(true);
      expect(badge.classList.contains('bb-status-badge--neutral')).toBe(false);
    });
  });

  describe('filteredItems', () => {
    it('should return all items when filter is empty', () => {
      expect(component.filteredItems().length).toBe(sampleItems.length);
    });

    it('should filter items by label (case-insensitive)', () => {
      component.filterCtrl.setValue('seed');
      expect(component.filteredItems().every((i) => i.label.toLowerCase().includes('seed'))).toBe(
        true,
      );
    });

    it('should return empty array when no items match filter', () => {
      component.filterCtrl.setValue('zzznomatch');
      expect(component.filteredItems()).toHaveLength(0);
    });
  });

  describe('showFilter input', () => {
    it('should hide the filter box by default', () => {
      const input = fixture.nativeElement.querySelector('.bb-filter-input');
      expect(input).toBeNull();
    });

    it('should render the filter box when showFilter is true', () => {
      fixture.componentRef.setInput('showFilter', true);
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('.bb-filter-input');
      expect(input).not.toBeNull();
    });
  });

  describe('action input', () => {
    it('should not render a header button by default', () => {
      const button = fixture.nativeElement.querySelector('.btn-link');
      expect(button).toBeNull();
    });

    it('should render a header button with the action label when set', () => {
      fixture.componentRef.setInput('action', { label: 'Manage', action: vi.fn() });
      fixture.detectChanges();
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-link');
      expect(button).not.toBeNull();
      expect(button.textContent?.trim()).toBe('Manage');
    });

    it('should invoke the action callback when the header button is clicked', () => {
      const actionFn = vi.fn();
      fixture.componentRef.setInput('action', { label: 'Manage', action: actionFn });
      fixture.detectChanges();
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-link');
      button.click();
      expect(actionFn).toHaveBeenCalledTimes(1);
    });
  });
});
