import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
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

    // Unlike the removed Highcharts version, ng2-charts' BaseChartDirective injects its
    // NG_CHARTS_CONFIGURATION token with `optional: true` and only calls canvas.getContext('2d')
    // guarded by isPlatformBrowser. jsdom's canvas stub returns null from getContext('2d') (no
    // 'canvas' package installed in this repo), so BaseChartDirective's own `!this.ctx` check in
    // render() bails out before ever constructing a real Chart.js instance. No special provider
    // or DI stub is needed here - the Highcharts version needed a stubbed provideHighcharts() to
    // satisfy an NG0201 because HighchartsChartComponent injected its loader eagerly and
    // non-optionally.
    await TestBed.configureTestingModule({
      imports: [PieChartWidget],
      providers: [{ provide: ThemeService, useValue: themeServiceMock }],
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

  it('should build one doughnut segment per slice, translating state bucket labelKeys', () => {
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

    const config = component.buildConfig();
    expect(config.data.labels).toEqual(['Downloading']);
    expect(config.data.datasets[0].data).toEqual([3]);
  });

  it('should use the raw key as the segment label for category slices (no labelKey)', () => {
    component.data = { groupBy: 'category', slices: [{ key: 'linux', value: 5 }] };
    fixture.detectChanges();

    const config = component.buildConfig();
    expect(config.data.labels).toEqual(['linux']);
    expect(config.data.datasets[0].data).toEqual([5]);
  });

  it('should leave the chart background transparent so the card surface shows through', () => {
    component.data = { groupBy: 'state', slices: [] };
    fixture.detectChanges();

    const config = component.buildConfig();
    expect(config.options.backgroundColor).toBe('transparent');
  });

  // Regression coverage: the template calls buildConfig() on every change detection pass, and
  // gridstack re-sets the `data` @Input on every live-polling tick even when nothing visibly
  // changed. Returning a NEW-but-equal object every time would still force Chart.js to redraw,
  // so buildConfig() must return the exact same cached reference when its inputs are unchanged.
  describe('memoization', () => {
    it('should return the same object reference on a second call with content-equal (but not identical) data', () => {
      component.data = { groupBy: 'state', slices: [{ key: 'downloading', value: 3 }] };
      fixture.detectChanges();
      const first = component.buildConfig();

      // A fresh object with equal values, not the same reference - proves the cache compares by
      // content, not by `data`'s object identity.
      component.data = { groupBy: 'state', slices: [{ key: 'downloading', value: 3 }] };
      const second = component.buildConfig();

      expect(second).toBe(first);
    });

    it('should return a new object reference when the data actually changes', () => {
      component.data = { groupBy: 'state', slices: [{ key: 'downloading', value: 3 }] };
      fixture.detectChanges();
      const first = component.buildConfig();

      component.data = { groupBy: 'state', slices: [{ key: 'downloading', value: 4 }] };
      const second = component.buildConfig();

      expect(second).not.toBe(first);
    });

    it('should return a new object reference when the theme family changes', () => {
      component.data = { groupBy: 'state', slices: [{ key: 'downloading', value: 3 }] };
      fixture.detectChanges();
      const first = component.buildConfig();

      themeServiceMock.family.set('aurora');
      const second = component.buildConfig();

      expect(second).not.toBe(first);
    });

    it('should return a new object reference when the effective mode changes', () => {
      component.data = { groupBy: 'state', slices: [{ key: 'downloading', value: 3 }] };
      fixture.detectChanges();
      const first = component.buildConfig();

      themeServiceMock.effectiveMode.set('dark');
      const second = component.buildConfig();

      expect(second).not.toBe(first);
    });

    // Regression coverage for a bug fixed in this rewrite: the removed Highcharts version's cache
    // signature omitted the active UI language, so switching languages with otherwise-unchanged
    // data left segment labels stuck in the old language until the underlying data next changed.
    it('should return a new object reference (with re-translated labels) when the active language changes', () => {
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
      const first = component.buildConfig();

      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('hu', {
        pages: {
          dashboard: { widgets: { 'pie-chart': { bucket: { downloading: 'Letöltés' } } } },
        },
      });
      translate.use('hu');
      const second = component.buildConfig();

      expect(second).not.toBe(first);
      expect(second.data.labels).toEqual(['Letöltés']);
    });
  });

  // Regression coverage for an "Important" review finding on the initial Chart.js swap:
  // buildConfig()'s cache signature already included the active language (proven above), but
  // nothing told Angular's zoneless change detection to re-invoke buildConfig() *because* the
  // language changed - it only rode along on the next unrelated theme/data-driven change
  // detection. This test proves the fix (reading a toSignal(onLangChange) signal inside
  // buildConfig()) by firing a real language change and letting Angular's own zoneless scheduler
  // run via fixture.whenStable() - WITHOUT ever calling buildConfig() or detectChanges()
  // manually afterwards. If the signal weren't wired in, nothing would tell Angular to re-check
  // this component and the spy below would never fire again.
  describe('language-change reactivity', () => {
    it('should re-invoke buildConfig() on its own when the active language changes, with no other trigger', async () => {
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
      await fixture.whenStable();

      const buildConfigSpy = vi.spyOn(component, 'buildConfig');
      buildConfigSpy.mockClear();

      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('hu', {
        pages: {
          dashboard: { widgets: { 'pie-chart': { bucket: { downloading: 'Letöltés' } } } },
        },
      });
      translate.use('hu');

      await fixture.whenStable();

      expect(buildConfigSpy).toHaveBeenCalled();
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
