import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom, skip } from 'rxjs';
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
    component.label = 'Status';
    component.activeKey = 'all';
    component.showAllCount = 10;
    component.items = sampleItems;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('items input', () => {
    it('should reflect items set via setter', () => {
      component.items = sampleItems;
      expect(component.items).toBe(sampleItems);
    });

    it('should treat null items as empty array', () => {
      component.items = null as any;
      expect(component.items).toEqual([]);
    });
  });

  describe('ngOnChanges', () => {
    it('should emit "all" when active item is removed from items list', () => {
      const emitted: string[] = [];
      component.itemSelected.subscribe((key) => emitted.push(key));

      component.activeKey = 'downloading';
      component.ngOnChanges({
        items: new SimpleChange(
          sampleItems,
          [{ key: 'seeding', label: 'Seeding', count: 7 }],
          false,
        ),
      });
      component.items = [{ key: 'seeding', label: 'Seeding', count: 7 }];

      expect(emitted).toContain('all');
    });

    it('should not emit when active item is still in the updated list', () => {
      const emitted: string[] = [];
      component.itemSelected.subscribe((key) => emitted.push(key));

      component.activeKey = 'downloading';
      const updatedItems = [...sampleItems];
      component.ngOnChanges({
        items: new SimpleChange(sampleItems, updatedItems, false),
      });

      expect(emitted).toHaveLength(0);
    });

    it('should not emit when activeKey is "all"', () => {
      const emitted: string[] = [];
      component.itemSelected.subscribe((key) => emitted.push(key));

      component.activeKey = 'all';
      component.ngOnChanges({
        items: new SimpleChange(sampleItems, [], false),
      });

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

  describe('filteredItems$', () => {
    it('should emit all items when filter is empty', async () => {
      const items = await firstValueFrom(component.filteredItems$);
      expect(items.length).toBe(sampleItems.length);
    });

    it('should filter items by label (case-insensitive)', async () => {
      const itemsPromise = firstValueFrom(component.filteredItems$.pipe(skip(1)));
      component.filterCtrl.setValue('seed');
      const items = await itemsPromise;
      expect(items.every((i) => i.label.toLowerCase().includes('seed'))).toBe(true);
    });

    it('should return empty array when no items match filter', async () => {
      const itemsPromise = firstValueFrom(component.filteredItems$.pipe(skip(1)));
      component.filterCtrl.setValue('zzznomatch');
      const items = await itemsPromise;
      expect(items).toHaveLength(0);
    });
  });
});
