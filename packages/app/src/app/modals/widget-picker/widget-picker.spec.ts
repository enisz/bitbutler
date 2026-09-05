import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { WidgetPicker } from './widget-picker';

describe('WidgetPicker', () => {
  let component: WidgetPicker;
  let fixture: ComponentFixture<WidgetPicker>;
  let activeOffcanvasMock: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    activeOffcanvasMock = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [WidgetPicker],
      providers: [{ provide: NgbActiveOffcanvas, useValue: activeOffcanvasMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetPicker);
    component = fixture.componentInstance;

    TestBed.inject(TranslateService).setTranslation('en', {
      pages: {
        dashboard: {
          catalog: {
            'stat-tile': 'Stat Tile',
            'torrent-list': 'Torrent List',
            'pie-chart': 'Pie Chart',
            'bar-chart': 'Bar Chart',
            'active-downloads': 'Active Downloads',
          },
          'chart-type': {
            number: 'Number',
            pie: 'Pie',
            line: 'Line',
            column: 'Column',
            table: 'Table',
          },
        },
      },
    });
    TestBed.inject(TranslateService).use('en');
    fixture.detectChanges();
  });

  function ids(): string[] {
    return component
      .typeGroups()
      .flatMap((g) => g.items.map((i) => i.id))
      .sort();
  }

  it('should list every catalog entry across type groups', () => {
    expect(ids()).toEqual([
      'active-downloads',
      'bar-chart',
      'pie-chart',
      'stat-tile',
      'torrent-list',
    ]);
  });

  it('should close the offcanvas with the chosen widget type id', () => {
    component.choose('stat-tile');
    expect(activeOffcanvasMock.close).toHaveBeenCalledWith('stat-tile');
  });

  it('should dismiss on cancel', () => {
    component.cancel();
    expect(activeOffcanvasMock.dismiss).toHaveBeenCalled();
  });

  describe('search', () => {
    it('should filter entries by translated label', () => {
      component.onQueryChange('pie');
      expect(ids()).toEqual(['pie-chart']);
    });

    it('should be case-insensitive', () => {
      component.onQueryChange('PIE');
      expect(ids()).toEqual(['pie-chart']);
    });

    it('should show the empty state when nothing matches', () => {
      component.onQueryChange('does-not-exist');
      expect(component.isEmpty()).toBe(true);
      expect(ids()).toEqual([]);
    });
  });

  describe('chart type filter', () => {
    it('should filter entries by chart type', () => {
      component.setFilter('table');
      expect(ids()).toEqual(['active-downloads', 'torrent-list']);
    });

    it('should show every entry again when switching back to all', () => {
      component.setFilter('table');
      component.setFilter('all');
      expect(ids()).toEqual([
        'active-downloads',
        'bar-chart',
        'pie-chart',
        'stat-tile',
        'torrent-list',
      ]);
    });

    it('should show the empty state for a chart type with no matching widgets', () => {
      component.setFilter('line');
      expect(component.isEmpty()).toBe(true);
    });
  });

  describe('type group collapse', () => {
    it('should start expanded and collapse on toggle', () => {
      const id = component.typeGroups()[0].id;
      expect(component.typeGroups().find((g) => g.id === id)?.expanded).toBe(true);

      component.toggleTypeGroup(id);
      expect(component.typeGroups().find((g) => g.id === id)?.expanded).toBe(false);

      component.toggleTypeGroup(id);
      expect(component.typeGroups().find((g) => g.id === id)?.expanded).toBe(true);
    });

    it('should force-expand a collapsed type group while searching', () => {
      const pieGroupId = component
        .typeGroups()
        .find((g) => g.items.some((i) => i.id === 'pie-chart'))!.id;
      component.toggleTypeGroup(pieGroupId);

      component.onQueryChange('pie');

      expect(component.typeGroups().find((g) => g.id === pieGroupId)?.expanded).toBe(true);
    });
  });

  describe('flatItems', () => {
    it('should list every match, ungrouped, regardless of the active filter', () => {
      expect(
        component
          .flatItems()
          .map((i) => i.id)
          .sort(),
      ).toEqual(['active-downloads', 'bar-chart', 'pie-chart', 'stat-tile', 'torrent-list']);
    });

    it('should narrow to a specific chart-type filter', () => {
      component.setFilter('table');
      expect(
        component
          .flatItems()
          .map((i) => i.id)
          .sort(),
      ).toEqual(['active-downloads', 'torrent-list']);
    });
  });

  describe('rendering', () => {
    it('should render an accordion (category toggle) per chart type when "all" is selected', () => {
      fixture.detectChanges();
      const toggles = fixture.nativeElement.querySelectorAll('.widget-picker__category-toggle');
      // 4 distinct chart types are actually populated: number, table, pie, column (no 'line' widget yet)
      expect(toggles.length).toBe(4);
    });

    it('should render a flat list with no accordion toggle when a specific chart type is selected', () => {
      component.setFilter('table');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.widget-picker__category-toggle')).toBeFalsy();
      const items = fixture.nativeElement.querySelectorAll(
        '.widget-picker__items--flat .widget-picker__item',
      );
      expect(items.length).toBe(2);
    });
  });
});
