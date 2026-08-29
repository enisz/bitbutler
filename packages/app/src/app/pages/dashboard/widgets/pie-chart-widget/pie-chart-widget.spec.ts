import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import type * as Highcharts from 'highcharts';
import { provideHighcharts } from 'highcharts-angular';
import { ThemeFamily, ThemeService } from '../../../../services/theme.service';
import { PieChartWidget } from './pie-chart-widget';

describe('PieChartWidget', () => {
  let fixture: ComponentFixture<PieChartWidget>;
  let component: PieChartWidget;
  let themeServiceMock: {
    family: ReturnType<typeof signal<ThemeFamily>>;
    effectiveMode: ReturnType<typeof signal<'light' | 'dark'>>;
  };

  beforeEach(async () => {
    themeServiceMock = {
      family: signal<ThemeFamily>('bitbutler'),
      effectiveMode: signal<'light' | 'dark'>('light'),
    };

    // provideHighcharts() is required because the template unconditionally renders
    // <highcharts-chart>, whose directive injects HighchartsChartService (needs
    // HIGHCHARTS_LOADER) as soon as the component tree is built - even though these tests
    // only assert on component.buildOptions()'s pure return value, not on the rendered chart.
    // Supply a loader that never resolves rather than the library default (which dynamically
    // imports 'highcharts/esm/highcharts' - an extensionless specifier Node's ESM resolver
    // rejects outside a bundler) so these tests stay synchronous and never construct a real
    // Highcharts chart in jsdom.
    await TestBed.configureTestingModule({
      imports: [PieChartWidget],
      providers: [
        provideHighcharts({ instance: () => new Promise(() => {}) }),
        { provide: ThemeService, useValue: themeServiceMock },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PieChartWidget);
    component = fixture.componentInstance;
    TestBed.inject(TranslateService).setTranslation('en', {
      pages: {
        dashboard: { widgets: { 'pie-chart': { bucket: { downloading: 'Downloading' } } } },
      },
    });
    TestBed.inject(TranslateService).use('en');
  });

  it('should build one Highcharts pie series point per slice, translating state bucket labelKeys', () => {
    component.data = {
      groupBy: 'state',
      slices: [
        {
          key: 'downloading',
          labelKey: 'pages.dashboard.widgets.pie-chart.bucket.downloading',
          value: 3,
        },
      ],
    };
    fixture.detectChanges();

    const options = component.buildOptions();
    const series = options.series![0] as Highcharts.SeriesPieOptions;
    expect(series.type).toBe('pie');
    expect(series.data).toEqual([expect.objectContaining({ name: 'Downloading', y: 3 })]);
  });

  it('should use the raw key as the point name for category slices (no labelKey)', () => {
    component.data = { groupBy: 'category', slices: [{ key: 'linux', value: 5 }] };
    fixture.detectChanges();

    const options = component.buildOptions();
    const series = options.series![0] as Highcharts.SeriesPieOptions;
    expect(series.data).toEqual([expect.objectContaining({ name: 'linux', y: 5 })]);
  });

  it('should render a transparent chart background so the card surface shows through', () => {
    component.data = { groupBy: 'state', slices: [] };
    fixture.detectChanges();

    const options = component.buildOptions();
    expect(options.chart?.backgroundColor).toBe('transparent');
  });

  // Regression coverage: the template calls buildOptions() on every change detection pass, and
  // gridstack re-sets the `data` @Input on every live-polling tick even when nothing visibly
  // changed. Returning a NEW-but-equal object every time would still force Highcharts to redraw,
  // so buildOptions() must return the exact same cached reference when its inputs are unchanged.
  describe('memoization', () => {
    it('should return the same object reference on a second call with content-equal (but not identical) data', () => {
      component.data = { groupBy: 'state', slices: [{ key: 'downloading', value: 3 }] };
      fixture.detectChanges();
      const first = component.buildOptions();

      // A fresh object with equal values, not the same reference - proves the cache compares by
      // content, not by `data`'s object identity.
      component.data = { groupBy: 'state', slices: [{ key: 'downloading', value: 3 }] };
      const second = component.buildOptions();

      expect(second).toBe(first);
    });

    it('should return a new object reference when the data actually changes', () => {
      component.data = { groupBy: 'state', slices: [{ key: 'downloading', value: 3 }] };
      fixture.detectChanges();
      const first = component.buildOptions();

      component.data = { groupBy: 'state', slices: [{ key: 'downloading', value: 4 }] };
      const second = component.buildOptions();

      expect(second).not.toBe(first);
    });

    it('should return a new object reference when the theme family changes', () => {
      component.data = { groupBy: 'state', slices: [{ key: 'downloading', value: 3 }] };
      fixture.detectChanges();
      const first = component.buildOptions();

      themeServiceMock.family.set('aurora');
      const second = component.buildOptions();

      expect(second).not.toBe(first);
    });

    it('should return a new object reference when the effective mode changes', () => {
      component.data = { groupBy: 'state', slices: [{ key: 'downloading', value: 3 }] };
      fixture.detectChanges();
      const first = component.buildOptions();

      themeServiceMock.effectiveMode.set('dark');
      const second = component.buildOptions();

      expect(second).not.toBe(first);
    });
  });

  // Regression coverage: the widget wires <app-widget-menu> identically across all three widget
  // types (gated by editMode, configure/remove routed to onConfigure()/onRemove()) - a typo in
  // any one of them would currently ship green with no test catching it.
  describe('widget menu integration', () => {
    it('should show the widget menu only in edit mode, and route configure/remove to onConfigure()/onRemove()', () => {
      component.data = { groupBy: 'state', slices: [] };
      component.onConfigure = vi.fn();
      component.onRemove = vi.fn();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.widget-menu')).toBeNull();

      fixture.componentRef.setInput('editMode', true);
      fixture.detectChanges();

      const menu = fixture.nativeElement.querySelector('.widget-menu');
      expect(menu).toBeTruthy();

      menu.querySelector('[data-test="widget-menu-configure"]').click();
      expect(component.onConfigure).toHaveBeenCalled();

      menu.querySelector('[data-test="widget-menu-remove"]').click();
      expect(component.onRemove).toHaveBeenCalled();
    });
  });
});
