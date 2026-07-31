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
    fixture.componentRef.setInput('activeKeys', new Set<string>());
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

  describe('auto-prune stale active keys', () => {
    it('should emit the stale key when an active item is removed from items list', () => {
      const emitted: string[] = [];
      component.itemSelected.subscribe((key) => emitted.push(key));

      fixture.componentRef.setInput('activeKeys', new Set(['downloading']));
      fixture.componentRef.setInput('items', [{ key: 'seeding', label: 'Seeding', count: 7 }]);
      fixture.detectChanges();

      expect(emitted).toEqual(['downloading']);
    });

    it('should preserve a sibling active key that is still present', () => {
      const emitted: string[] = [];
      component.itemSelected.subscribe((key) => emitted.push(key));

      fixture.componentRef.setInput('activeKeys', new Set(['downloading', 'seeding']));
      fixture.componentRef.setInput('items', [{ key: 'seeding', label: 'Seeding', count: 7 }]);
      fixture.detectChanges();

      expect(emitted).toEqual(['downloading']);
    });

    it('should not emit when all active items are still in the updated list', () => {
      const emitted: string[] = [];
      component.itemSelected.subscribe((key) => emitted.push(key));

      fixture.componentRef.setInput('activeKeys', new Set(['downloading']));
      fixture.componentRef.setInput('items', [...sampleItems]);
      fixture.detectChanges();

      expect(emitted).toHaveLength(0);
    });

    it('should not emit when activeKeys is empty', () => {
      const emitted: string[] = [];
      component.itemSelected.subscribe((key) => emitted.push(key));

      fixture.componentRef.setInput('activeKeys', new Set());
      fixture.componentRef.setInput('items', []);
      fixture.detectChanges();

      expect(emitted).toHaveLength(0);
    });
  });

  describe('active row highlighting', () => {
    it('should mark the "All" row active when activeKeys is empty', () => {
      fixture.componentRef.setInput('activeKeys', new Set());
      fixture.detectChanges();
      const items: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.list-group-item'),
      );
      const allItem = items.find((el) => el.textContent?.includes('all'));
      expect(allItem?.classList.contains('active')).toBe(true);
    });

    it('should mark the "All" row active again once the only active key is toggled off', () => {
      fixture.componentRef.setInput('activeKeys', new Set(['downloading']));
      fixture.detectChanges();
      fixture.componentRef.setInput('activeKeys', new Set());
      fixture.detectChanges();
      const items: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.list-group-item'),
      );
      const allItem = items.find((el) => el.textContent?.includes('all'));
      expect(allItem?.classList.contains('active')).toBe(true);
    });

    it('should mark multiple item rows active simultaneously, and "All" inactive', () => {
      fixture.componentRef.setInput('activeKeys', new Set(['downloading', 'seeding']));
      fixture.detectChanges();
      const items: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.list-group-item'),
      );
      const downloadingItem = items.find((el) => el.textContent?.includes('Downloading'));
      const seedingItem = items.find((el) => el.textContent?.includes('Seeding'));
      const allItem = items.find((el) => el.textContent?.includes('All'));
      expect(downloadingItem?.classList.contains('active')).toBe(true);
      expect(seedingItem?.classList.contains('active')).toBe(true);
      expect(allItem?.classList.contains('active')).toBe(false);
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
      fixture.componentRef.setInput('showAll', false);
      fixture.componentRef.setInput('items', [{ key: 'a', label: 'A', count: 1 }]);
      fixture.detectChanges();
      const badge: HTMLElement = fixture.nativeElement.querySelector('.bb-status-badge');
      expect(badge.classList.contains('bb-status-badge--neutral')).toBe(true);
      expect(badge.classList.contains('text-bg-success')).toBe(false);
    });

    it('should apply a text-bg-{variant} class when an item has a variant', () => {
      fixture.componentRef.setInput('showAll', false);
      fixture.componentRef.setInput('items', [
        { key: 'a', label: 'A', count: 1, variant: 'success' },
      ]);
      fixture.detectChanges();
      const badge: HTMLElement = fixture.nativeElement.querySelector('.bb-status-badge');
      expect(badge.classList.contains('text-bg-success')).toBe(true);
      expect(badge.classList.contains('bb-status-badge--neutral')).toBe(false);
    });
  });

  describe('item variant coloring', () => {
    it('should not apply a bb-variant class when an item has no variant', () => {
      fixture.componentRef.setInput('showAll', false);
      fixture.componentRef.setInput('items', [{ key: 'a', label: 'A', count: 1 }]);
      fixture.detectChanges();
      const item: HTMLElement = fixture.nativeElement.querySelector('.list-group-item');
      expect(item.className).not.toContain('bb-variant-');
    });

    it('should apply a bb-variant-{variant} class to the item when a variant is set', () => {
      fixture.componentRef.setInput('showAll', false);
      fixture.componentRef.setInput('items', [
        { key: 'a', label: 'A', count: 1, variant: 'danger' },
      ]);
      fixture.detectChanges();
      const item: HTMLElement = fixture.nativeElement.querySelector('.list-group-item');
      expect(item.classList.contains('bb-variant-danger')).toBe(true);
    });

    it('should not apply the class to the "All" item, which never has a variant', () => {
      fixture.componentRef.setInput('showAll', true);
      fixture.componentRef.setInput('items', [
        { key: 'a', label: 'A', count: 1, variant: 'success' },
      ]);
      fixture.detectChanges();
      const items: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.list-group-item'),
      );
      const allItem = items.find((el) => el.textContent?.includes('all'));
      expect(allItem?.className).not.toContain('bb-variant-');
    });
  });

  describe('filteredItems', () => {
    const waitForDebounce = () => new Promise((resolve) => setTimeout(resolve, 200));

    it('should return all items when filter is empty', () => {
      expect(component.filteredItems().length).toBe(sampleItems.length);
    });

    it('should filter items by label (case-insensitive)', async () => {
      component.filterCtrl.setValue('seed');
      await waitForDebounce();
      expect(component.filteredItems().every((i) => i.label.toLowerCase().includes('seed'))).toBe(
        true,
      );
    });

    it('should return empty array when no items match filter', async () => {
      component.filterCtrl.setValue('zzznomatch');
      await waitForDebounce();
      expect(component.filteredItems()).toHaveLength(0);
    });

    it('should not duplicate items when the filter is cleared after narrowing', async () => {
      fixture.componentRef.setInput('showFilter', true);
      fixture.detectChanges();

      component.filterCtrl.setValue('seed');
      await waitForDebounce();
      fixture.detectChanges();

      component.filterCtrl.setValue('');
      await waitForDebounce();
      fixture.detectChanges();

      const keys = component.filteredItems().map((i) => i.key);
      expect(new Set(keys).size).toBe(keys.length);

      const labelElements: NodeListOf<HTMLElement> = (
        fixture.nativeElement as HTMLElement
      ).querySelectorAll('.bb-status-label');
      const renderedLabels = Array.from(labelElements).map((el) => el.textContent?.trim());
      expect(new Set(renderedLabels).size).toBe(renderedLabels.length);
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
