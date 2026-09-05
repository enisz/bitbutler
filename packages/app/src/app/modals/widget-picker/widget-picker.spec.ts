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
        },
      },
    });
    TestBed.inject(TranslateService).use('en');
    fixture.detectChanges();
  });

  function ids(): string[] {
    return component
      .categories()
      .flatMap((c) => c.items.map((i) => i.id))
      .sort();
  }

  it('should list every catalog entry across categories', () => {
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

  describe('category collapse', () => {
    it('should start expanded and collapse on toggle', () => {
      const id = component.categories()[0].id;
      expect(component.categories().find((c) => c.id === id)?.expanded).toBe(true);

      component.toggleCategory(id);
      expect(component.categories().find((c) => c.id === id)?.expanded).toBe(false);

      component.toggleCategory(id);
      expect(component.categories().find((c) => c.id === id)?.expanded).toBe(true);
    });

    it('should force-expand a collapsed category while searching', () => {
      const id = component.categories()[0].id;
      component.toggleCategory(id);

      component.onQueryChange('pie');

      expect(component.categories().find((c) => c.id === id)?.expanded).toBe(true);
    });
  });
});
