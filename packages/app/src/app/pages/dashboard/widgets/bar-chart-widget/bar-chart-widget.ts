import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartData,
  ChartOptions,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { BaseWidget } from 'gridstack/dist/angular';
import { BaseChartDirective } from 'ng2-charts';
import { BarChartData } from '../../../../models/dashboard.model';
import { ThemeService } from '../../../../services/theme.service';
import { bodyColor, memoizeBySignature, themeColors } from '../chart-widget-utils';
import { WidgetMenu } from '../widget-menu/widget-menu';

// Registered here (module scope) for the same reason as pie-chart-widget.ts: keeps 'chart.js' out
// of the eagerly-bundled main chunk, only pulled in when this lazy-loaded widget actually renders.
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

interface BarChartRenderConfig {
  data: ChartData<'bar', number[], string>;
  options: ChartOptions<'bar'>;
}

@Component({
  selector: 'app-bar-chart-widget',
  standalone: true,
  imports: [BaseChartDirective, WidgetMenu],
  templateUrl: './bar-chart-widget.html',
  styleUrl: './bar-chart-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarChartWidget extends BaseWidget {
  @Input() data!: BarChartData;
  @Input() onConfigure?: () => void;
  @Input() onRemove?: () => void;

  readonly chartType = 'bar' as const;

  private readonly translate = inject(TranslateService);
  private readonly themeService = inject(ThemeService);
  private readonly languageChanged = toSignal(this.translate.onLangChange);
  private readonly cache = memoizeBySignature<BarChartRenderConfig>();

  buildConfig(): BarChartRenderConfig {
    const family = this.themeService.family();
    const mode = this.themeService.effectiveMode();
    this.languageChanged();
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

    const config: BarChartRenderConfig = {
      data: { labels, datasets: [{ data: values, backgroundColor }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        backgroundColor: 'transparent',
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { ticks: { color: textColor }, beginAtZero: true },
        },
        plugins: { legend: { display: false } },
      },
    };

    this.cache.set(signature, config);
    return config;
  }
}
