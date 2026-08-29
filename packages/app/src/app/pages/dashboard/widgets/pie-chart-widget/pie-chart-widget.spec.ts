import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import type * as Highcharts from 'highcharts';
import { provideHighcharts } from 'highcharts-angular';
import { PieChartWidget } from './pie-chart-widget';

describe('PieChartWidget', () => {
  let fixture: ComponentFixture<PieChartWidget>;
  let component: PieChartWidget;

  beforeEach(async () => {
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
      providers: [provideHighcharts({ instance: () => new Promise(() => {}) })],
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
});
