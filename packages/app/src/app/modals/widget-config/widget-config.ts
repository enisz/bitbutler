import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import {
  PieChartConfig,
  PieChartGroupBy,
  StatTileConfig,
  StatTileMetric,
  TorrentListColumn,
  TorrentListConfig,
  TorrentListSortField,
  WidgetConfig as WidgetConfigModel,
  WidgetTypeId,
} from '../../models/dashboard.model';

@Component({
  selector: 'app-widget-config',
  standalone: true,
  imports: [FormsModule, NgSelectComponent, TranslatePipe],
  templateUrl: './widget-config.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetConfig {
  private readonly activeModal = inject(NgbActiveModal);

  readonly widgetTypeId = input.required<WidgetTypeId>();
  readonly initialConfig = input.required<WidgetConfigModel>();

  readonly statTileMetrics: StatTileMetric[] = [
    'download_speed',
    'upload_speed',
    'active_count',
    'global_ratio',
    'free_disk_space',
  ];

  readonly sortFields: TorrentListSortField[] = [
    'ratio',
    'dlspeed',
    'upspeed',
    'size',
    'progress',
    'added_on',
    'eta',
  ];

  readonly availableColumns: TorrentListColumn[] = [
    'name',
    'state',
    'category',
    'ratio',
    'dlspeed',
    'upspeed',
    'size',
    'progress',
    'added_on',
    'eta',
  ];

  readonly groupByOptions: PieChartGroupBy[] = ['state', 'category'];

  readonly config = linkedSignal<WidgetConfigModel>(() => this.initialConfig());

  readonly isStatTile = computed(() => this.widgetTypeId() === 'stat-tile');
  readonly isPieChart = computed(() => this.widgetTypeId() === 'pie-chart');
  readonly statTileConfig = computed(() => this.config() as StatTileConfig);
  readonly torrentListConfig = computed(() => this.config() as TorrentListConfig);
  readonly pieChartConfig = computed(() => this.config() as PieChartConfig);

  updateStatTileMetric(metric: StatTileMetric): void {
    this.config.set({ metric } satisfies StatTileConfig);
  }

  updatePieChartGroupBy(groupBy: PieChartGroupBy): void {
    this.config.set({ groupBy } satisfies PieChartConfig);
  }

  updateTorrentListField<K extends keyof TorrentListConfig>(
    key: K,
    value: TorrentListConfig[K],
  ): void {
    this.config.update((c) => ({ ...(c as TorrentListConfig), [key]: value }));
  }

  toggleColumn(column: TorrentListColumn): void {
    const c = this.config() as TorrentListConfig;
    const has = c.columns.includes(column);
    const columns = has ? c.columns.filter((x) => x !== column) : [...c.columns, column];
    this.config.set({ ...c, columns });
  }

  save(): void {
    this.activeModal.close(this.config());
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
