import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import {
  PieChartConfig,
  PieChartField,
  ServerMetricId,
  StatTileConfig,
  TorrentListConfig,
  WidgetConfig as WidgetConfigModel,
  WidgetTypeId,
} from '../../models/dashboard.model';
import { SERVER_METRIC_CATALOG } from '../../pages/dashboard/server-metric-catalog';
import { TORRENT_FIELD_CATALOG, TorrentField } from '../../pages/dashboard/torrent-field-catalog';

export interface TorrentFieldOption {
  value: TorrentField;
  label: string;
}

@Component({
  selector: 'app-widget-config',
  standalone: true,
  imports: [
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    TranslatePipe,
    BbBtnContent,
  ],
  templateUrl: './widget-config.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetConfig {
  private readonly activeModal = inject(NgbActiveModal);
  private readonly translateService = inject(TranslateService);

  readonly icons = { faFloppyDisk, faXmark };

  readonly widgetTypeId = input.required<WidgetTypeId>();
  readonly initialConfig = input.required<WidgetConfigModel>();

  readonly statTileMetrics: ServerMetricId[] = SERVER_METRIC_CATALOG.map((m) => m.id);

  // Every Torrent field is a valid sort-by / column choice, labeled via the main grid's own
  // translations (see torrent-field-catalog.ts) and sorted alphabetically by that translated
  // label - same approach as the "Visible columns" picker in Settings > Torrent List Grid.
  readonly torrentFieldOptions: TorrentFieldOption[] = TORRENT_FIELD_CATALOG.map((m) => ({
    value: m.field,
    label: this.translateService.instant(m.labelKey),
  })).sort((a, b) => a.label.localeCompare(b.label));

  readonly groupByOptions: PieChartField[] = ['state', 'category'];

  readonly config = linkedSignal<WidgetConfigModel>(() => this.initialConfig());

  readonly isStatTile = computed(() => this.widgetTypeId() === 'stat-tile');
  readonly isPieChart = computed(() => this.widgetTypeId() === 'pie-chart');
  // Narrowed to the { metric } variant - the torrent-count source-toggle UI is Task 10.
  readonly statTileConfig = computed(
    () => this.config() as Extract<StatTileConfig, { metric: ServerMetricId }>,
  );
  readonly torrentListConfig = computed(() => this.config() as TorrentListConfig);
  readonly pieChartConfig = computed(() => this.config() as PieChartConfig);

  readonly widgetLabelKey = computed(() => `pages.dashboard.catalog.${this.widgetTypeId()}`);

  readonly canSave = computed(() => {
    if (this.widgetTypeId() !== 'torrent-list') return true;

    const c = this.torrentListConfig();
    return (
      !!(c.title ?? '').trim() &&
      Number.isFinite(c.count) &&
      c.count >= 1 &&
      !!c.sortField &&
      !!c.sortOrder &&
      c.columns.length > 0
    );
  });

  updateStatTileMetric(metric: ServerMetricId): void {
    this.config.set({ metric } satisfies StatTileConfig);
  }

  updatePieChartGroupBy(groupBy: PieChartField): void {
    this.config.set({ groupBy } satisfies PieChartConfig);
  }

  updateTorrentListField<K extends keyof TorrentListConfig>(
    key: K,
    value: TorrentListConfig[K],
  ): void {
    this.config.update((c) => ({ ...(c as TorrentListConfig), [key]: value }));
  }

  save(): void {
    this.activeModal.close(this.config());
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
