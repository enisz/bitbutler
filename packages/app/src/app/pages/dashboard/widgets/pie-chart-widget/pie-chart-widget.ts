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
  @Input() onConfigure!: () => void;
  @Input() onRemove!: () => void;

  private readonly translate = inject(TranslateService);
  private readonly themeService = inject(ThemeService);

  private themeColors(): string[] {
    const styles = getComputedStyle(document.documentElement);
    return COLOR_TOKENS.map((token) => styles.getPropertyValue(token).trim());
  }

  private bodyColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue('--bs-body-color').trim();
  }

  buildOptions(): Highcharts.Options {
    // Re-read ThemeService here (rather than caching) so buildOptions() picks up the current
    // family/mode every time it's called - the caller (the template's [options] binding) re-runs
    // it on every change detection pass, which includes theme changes.
    this.themeService.family();
    this.themeService.effectiveMode();

    const colors = this.themeColors();
    const textColor = this.bodyColor();

    const points = this.data.slices.map((slice, i) => ({
      name: slice.labelKey ? this.translate.instant(slice.labelKey) : slice.key,
      y: slice.value,
      color: colors[i % colors.length],
    }));

    return {
      chart: { type: 'pie', backgroundColor: 'transparent', style: { color: textColor } },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { itemStyle: { color: textColor } },
      plotOptions: { pie: { innerSize: '60%', dataLabels: { enabled: false } } },
      series: [{ type: 'pie', name: '', data: points }],
    };
  }
}
