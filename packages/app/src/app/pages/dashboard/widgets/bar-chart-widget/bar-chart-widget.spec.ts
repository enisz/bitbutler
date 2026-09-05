import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { ThemeFamily, ThemeService } from '../../../../services/theme.service';
import { BarChartWidget } from './bar-chart-widget';

describe('BarChartWidget', () => {
  let fixture: ComponentFixture<BarChartWidget>;
  let component: BarChartWidget;
  let themeServiceMock: {
    family: ReturnType<typeof signal<ThemeFamily>>;
    effectiveMode: ReturnType<typeof signal<'light' | 'dark'>>;
  };

  beforeEach(async () => {
    themeServiceMock = {
      family: signal<ThemeFamily>('bitbutler'),
      effectiveMode: signal<'light' | 'dark'>('light'),
    };

    await TestBed.configureTestingModule({
      imports: [BarChartWidget],
      providers: [{ provide: ThemeService, useValue: themeServiceMock }],
    }).compileComponents();
    fixture = TestBed.createComponent(BarChartWidget);
    component = fixture.componentInstance;
    TestBed.inject(TranslateService).setTranslation('en', {
      pages: {
        main: { grid: { 'grid-lib': { 'col-def': { ratio: 'Ratio', category: 'Category' } } } },
        dashboard: {
          widgets: { breakdown: { ratio: { bucket: { 'lt-0-1': '< 0.1' } } } },
        },
      },
    });
    TestBed.inject(TranslateService).use('en');
  });

  describe('title header', () => {
    it('should show the translated label for the field being broken down', () => {
      component.data = { field: 'ratio', slices: [] };
      fixture.detectChanges();
      const title = fixture.nativeElement.querySelector('.bar-chart-widget__title');
      expect(title.textContent.trim()).toBe('Ratio');
    });

    it('should update when the config field changes', () => {
      component.data = { field: 'category', slices: [] };
      fixture.detectChanges();
      const title = fixture.nativeElement.querySelector('.bar-chart-widget__title');
      expect(title.textContent.trim()).toBe('Category');
    });
  });

  it('should build one bar per slice, translating bucket labelKeys', () => {
    component.data = {
      field: 'ratio',
      slices: [
        {
          key: 'lt-0-1',
          labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.lt-0-1',
          value: 4,
        },
      ],
    };
    fixture.detectChanges();

    const config = component.buildConfig();
    expect(config.data.labels).toEqual(['< 0.1']);
    expect(config.data.datasets[0].data).toEqual([4]);
  });

  it('should use the raw key as the bar label when there is no labelKey', () => {
    component.data = { field: 'category', slices: [{ key: 'linux', value: 5 }] };
    fixture.detectChanges();

    const config = component.buildConfig();
    expect(config.data.labels).toEqual(['linux']);
  });

  it('should leave the chart background transparent so the card surface shows through', () => {
    component.data = { field: 'category', slices: [] };
    fixture.detectChanges();

    const config = component.buildConfig();
    expect(config.options.backgroundColor).toBe('transparent');
  });

  describe('memoization', () => {
    it('should return the same object reference on a second call with content-equal data', () => {
      component.data = { field: 'category', slices: [{ key: 'linux', value: 5 }] };
      fixture.detectChanges();
      const first = component.buildConfig();

      component.data = { field: 'category', slices: [{ key: 'linux', value: 5 }] };
      const second = component.buildConfig();

      expect(second).toBe(first);
    });

    it('should return a new object reference when the data actually changes', () => {
      component.data = { field: 'category', slices: [{ key: 'linux', value: 5 }] };
      fixture.detectChanges();
      const first = component.buildConfig();

      component.data = { field: 'category', slices: [{ key: 'linux', value: 6 }] };
      const second = component.buildConfig();

      expect(second).not.toBe(first);
    });
  });

  describe('widget menu integration', () => {
    it('should show the widget menu and route configure/remove to onConfigure()/onRemove()', () => {
      component.data = { field: 'category', slices: [] };
      component.onConfigure = vi.fn();
      component.onRemove = vi.fn();
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
