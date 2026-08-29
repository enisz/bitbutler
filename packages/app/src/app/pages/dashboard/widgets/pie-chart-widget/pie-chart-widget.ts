import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
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
import { WidgetMenu } from '../widget-menu/widget-menu';

// Registered here (module scope), rather than via ng2-charts' provideCharts() in app.config.ts,
// so 'chart.js' is only ever imported from this lazy-loaded widget file - keeping it out of the
// eagerly-bundled main chunk entirely (mirroring how the removed Highcharts version's loader was
// only ever pulled in when this widget actually rendered). BaseChartDirective's own
// NG_CHARTS_CONFIGURATION injection is optional, so registering directly with Chart.register()
// here needs no corresponding app-level provider.
Chart.register(DoughnutController, ArcElement, Legend, Tooltip);

const COLOR_TOKENS = [
  '--bs-primary',
  '--bs-secondary',
  '--bs-success',
  '--bs-danger',
  '--bs-warning',
  '--bs-info',
];

interface PieChartRenderConfig {
  data: ChartData<'doughnut', number[], string>;
  options: ChartOptions<'doughnut'>;
}

@Component({
  selector: 'app-pie-chart-widget',
  standalone: true,
  imports: [BaseChartDirective, WidgetMenu],
  templateUrl: './pie-chart-widget.html',
  styleUrl: './pie-chart-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PieChartWidget extends BaseWidget {
  @Input() data!: PieChartData;
  @Input() editMode = false;
  @Input() onConfigure?: () => void;
  @Input() onRemove?: () => void;

  readonly chartType = 'doughnut' as const;

  private readonly translate = inject(TranslateService);
  private readonly themeService = inject(ThemeService);

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
  private cachedSignature: string | null = null;
  private cachedConfig: PieChartRenderConfig | null = null;

  private themeColors(styles: CSSStyleDeclaration): string[] {
    return COLOR_TOKENS.map((token) => styles.getPropertyValue(token).trim());
  }

  private bodyColor(styles: CSSStyleDeclaration): string {
    return styles.getPropertyValue('--bs-body-color').trim();
  }

  buildConfig(): PieChartRenderConfig {
    // Re-read ThemeService here (rather than caching across calls) so the signature below always
    // reflects the current family/mode - the caller (the template's [data]/[options] bindings)
    // re-runs this on every change detection pass, which includes theme changes.
    const family = this.themeService.family();
    const mode = this.themeService.effectiveMode();
    const lang = this.translate.currentLang;
    const signature = JSON.stringify({ data: this.data, family, mode, lang });

    if (this.cachedConfig && this.cachedSignature === signature) {
      return this.cachedConfig;
    }

    const styles = getComputedStyle(document.documentElement);
    const colors = this.themeColors(styles);
    const textColor = this.bodyColor(styles);

    const labels = this.data.slices.map((slice) =>
      slice.labelKey ? this.translate.instant(slice.labelKey) : slice.key,
    );
    const values = this.data.slices.map((slice) => slice.value);
    const backgroundColor = this.data.slices.map((_, i) => colors[i % colors.length]);

    const config: PieChartRenderConfig = {
      data: {
        labels,
        datasets: [{ data: values, backgroundColor }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        // Chart.js canvases have no fill of their own by default - unlike Highcharts, which
        // paints an opaque white chart.backgroundColor unless overridden, there is no separate
        // "whole canvas" background concept in Chart.js core. This `backgroundColor` is only the
        // base fallback color Chart.js would use for an arc that doesn't specify its own color,
        // which never happens here since every slice above gets one from the theme. The card
        // surface actually shows through because nothing paints the canvas itself - keeping this
        // set to 'transparent' documents that intentionally, rather than leaving it unset.
        backgroundColor: 'transparent',
        plugins: {
          legend: { labels: { color: textColor } },
        },
      },
    };

    this.cachedSignature = signature;
    this.cachedConfig = config;
    return config;
  }
}
