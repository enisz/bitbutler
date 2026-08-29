import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BaseWidget } from 'gridstack/dist/angular';
import * as Highcharts from 'highcharts';
import { HighchartsChartComponent } from 'highcharts-angular';
import { PieChartData } from '../../../../models/dashboard.model';
import { ThemeService } from '../../../../services/theme.service';
import { WidgetMenu } from '../widget-menu/widget-menu';

const COLOR_TOKENS = [
  '--bs-primary',
  '--bs-secondary',
  '--bs-success',
  '--bs-danger',
  '--bs-warning',
  '--bs-info',
];

@Component({
  selector: 'app-pie-chart-widget',
  standalone: true,
  imports: [HighchartsChartComponent, WidgetMenu],
  templateUrl: './pie-chart-widget.html',
  styleUrl: './pie-chart-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PieChartWidget extends BaseWidget {
  @Input() data!: PieChartData;
  @Input() editMode = false;
  @Input() onConfigure?: () => void;
  @Input() onRemove?: () => void;

  private readonly translate = inject(TranslateService);
  private readonly themeService = inject(ThemeService);

  // Memoizes buildOptions()'s result so an unchanged call returns the SAME object reference
  // rather than an equal-looking new one. The template calls buildOptions() on every change
  // detection pass, and gridstack's deserialize/setInput machinery re-sets the `data` @Input on
  // every grid load() - which fires on every live-polling tick, even when nothing visibly
  // changed. Angular's template-binding dirty-check skips an unchanged, ===-identical value, so
  // returning the cached reference stops highcharts-angular's own update effect (and the
  // resulting full Highcharts redraw + getComputedStyle() calls) from firing needlessly.
  private cachedSignature: string | null = null;
  private cachedOptions: Highcharts.Options | null = null;

  private themeColors(styles: CSSStyleDeclaration): string[] {
    return COLOR_TOKENS.map((token) => styles.getPropertyValue(token).trim());
  }

  private bodyColor(styles: CSSStyleDeclaration): string {
    return styles.getPropertyValue('--bs-body-color').trim();
  }

  buildOptions(): Highcharts.Options {
    // Re-read ThemeService here (rather than caching across calls) so the signature below always
    // reflects the current family/mode - the caller (the template's [options] binding) re-runs
    // this on every change detection pass, which includes theme changes.
    const family = this.themeService.family();
    const mode = this.themeService.effectiveMode();
    const signature = JSON.stringify({ data: this.data, family, mode });

    if (this.cachedOptions && this.cachedSignature === signature) {
      return this.cachedOptions;
    }

    const styles = getComputedStyle(document.documentElement);
    const colors = this.themeColors(styles);
    const textColor = this.bodyColor(styles);

    const points = this.data.slices.map((slice, i) => ({
      name: slice.labelKey ? this.translate.instant(slice.labelKey) : slice.key,
      y: slice.value,
      color: colors[i % colors.length],
    }));

    const options: Highcharts.Options = {
      chart: { type: 'pie', backgroundColor: 'transparent', style: { color: textColor } },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { itemStyle: { color: textColor } },
      plotOptions: { pie: { innerSize: '60%', dataLabels: { enabled: false } } },
      series: [{ type: 'pie', name: '', data: points }],
    };

    this.cachedSignature = signature;
    this.cachedOptions = options;
    return options;
  }
}
