import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ArcElement,
  Chart,
  ChartData,
  ChartOptions,
  DoughnutController,
  Legend,
  Tooltip,
} from 'chart.js';
import { BaseWidget } from 'gridstack/dist/angular';
import { BaseChartDirective } from 'ng2-charts';
import { PieChartData } from '../../../../models/dashboard.model';
import { ThemeService } from '../../../../services/theme.service';
import { BREAKDOWN_FIELD_META_BY_FIELD } from '../../breakdown-field-catalog';
import { bodyColor, memoizeBySignature, themeColors } from '../chart-widget-utils';
import { WidgetMenu } from '../widget-menu/widget-menu';

// Registered here (module scope), rather than via ng2-charts' provideCharts() in app.config.ts,
// so 'chart.js' is only ever imported from this lazy-loaded widget file - keeping it out of the
// eagerly-bundled main chunk entirely (mirroring how the removed Highcharts version's loader was
// only ever pulled in when this widget actually rendered). BaseChartDirective's own
// NG_CHARTS_CONFIGURATION injection is optional, so registering directly with Chart.register()
// here needs no corresponding app-level provider.
Chart.register(DoughnutController, ArcElement, Legend, Tooltip);

interface PieChartRenderConfig {
  data: ChartData<'doughnut', number[], string>;
  options: ChartOptions<'doughnut'>;
}

@Component({
  selector: 'app-pie-chart-widget',
  standalone: true,
  imports: [BaseChartDirective, WidgetMenu, TranslatePipe],
  templateUrl: './pie-chart-widget.html',
  styleUrl: './pie-chart-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PieChartWidget extends BaseWidget {
  @Input() data!: PieChartData;
  @Input() onConfigure?: () => void;
  @Input() onRemove?: () => void;

  readonly chartType = 'doughnut' as const;

  fieldLabelKey(): string {
    return BREAKDOWN_FIELD_META_BY_FIELD[this.data.groupBy].labelKey;
  }

  private readonly translate = inject(TranslateService);
  private readonly themeService = inject(ThemeService);

  // Same toSignal(onLangChange) pattern used by ~10 other components in this codebase (status.ts,
  // general.ts, login.ts, the column-filter family) - reading this signal (its emitted value is
  // discarded; `translate.currentLang` below is what's actually used) registers
  // TranslateService.onLangChange as a reactive dependency of this component's view. buildConfig()
  // is invoked directly from the template's [data]/[options] bindings, so that read happens inside
  // the template's reactive consumer context: a language switch now schedules this component's
  // next change detection directly, the same way a theme-signal change does, rather than only
  // being picked up incidentally whenever some other unrelated trigger (a theme change, or
  // gridstack's periodic `data` @Input reset from live polling) next runs change detection.
  private readonly languageChanged = toSignal(this.translate.onLangChange);

  // Memoizes buildConfig()'s result so an unchanged call returns the SAME object reference
  // rather than an equal-looking new one. The template calls buildConfig() on every change
  // detection pass, and gridstack's deserialize/setInput machinery re-sets the `data` @Input on
  // every grid load() - which fires on every live-polling tick, even when nothing visibly
  // changed. Angular's template-binding dirty-check skips an unchanged, ===-identical value, so
  // returning the cached reference stops ng2-charts' own ngOnChanges-driven update (and the
  // resulting Chart.js redraw + getComputedStyle() calls) from firing needlessly.
  //
  // The signature includes the active translation language alongside data/family/mode - a prior
  // (Highcharts-based) version of this cache omitted the language, so a runtime language switch
  // with otherwise-unchanged data left segment labels stuck in the old language until the
  // underlying data next changed. Including `translate.currentLang` here closes that gap.
  private readonly cache = memoizeBySignature<PieChartRenderConfig>();

  buildConfig(): PieChartRenderConfig {
    // Re-read ThemeService here (rather than caching across calls) so the signature below always
    // reflects the current family/mode - the caller (the template's [data]/[options] bindings)
    // re-runs this on every change detection pass, which includes theme changes.
    const family = this.themeService.family();
    const mode = this.themeService.effectiveMode();
    this.languageChanged(); // registers the reactive dependency - see field comment above
    const lang = this.translate.currentLang;
    const signature = JSON.stringify({ data: this.data, family, mode, lang });

    const cached = this.cache.get(signature);
    if (cached) return cached;

    const styles = getComputedStyle(document.documentElement);
    const colors = themeColors(styles);
    const textColor = bodyColor(styles);

    const labels = this.data.slices.map((slice) =>
      slice.labelKey ? this.translate.instant(slice.labelKey) : slice.key,
    );
    const values = this.data.slices.map((slice) => slice.value);
    const backgroundColor = this.data.slices.map((_, i) => colors[i % colors.length]);

    const config: PieChartRenderConfig = {
      data: { labels, datasets: [{ data: values, backgroundColor }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // Live-polling ticks push new (content-changed) data roughly every 2s - Chart.js's
        // default update animation would replay its ~1s arc-rotate tween on every one of those,
        // reading as the whole ring getting redrawn. Disabling it makes updates apply instantly.
        animation: false,
        cutout: '75%',
        backgroundColor: 'transparent',
        // 'right' rather than the default 'top' - a categorical field with many distinct values
        // (e.g. tracker/save_path) produces a long legend that would otherwise wrap onto several
        // lines above the chart, squeezing the ring down to a sliver.
        plugins: { legend: { position: 'right', labels: { color: textColor } } },
      },
    };

    this.cache.set(signature, config);
    return config;
  }
}
