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
});
