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
  ActiveDownloadsConfig,
  BarChartConfig,
  BreakdownField,
  PieChartConfig,
  PieChartField,
  ServerMetricId,
  StatTileConfig,
  TorrentListConfig,
  WidgetConfig as WidgetConfigModel,
  WidgetTypeId,
} from '../../models/dashboard.model';
import { BREAKDOWN_FIELD_CATALOG } from '../../pages/dashboard/breakdown-field-catalog';
import { SERVER_METRIC_CATALOG } from '../../pages/dashboard/server-metric-catalog';
import { TORRENT_FIELD_CATALOG, TorrentField } from '../../pages/dashboard/torrent-field-catalog';
import { listBreakdownValues } from '../../pages/dashboard/widget-selectors';
import { TorrentStoreService } from '../../services/torrent-store.service';

export interface TorrentFieldOption {
  value: TorrentField;
  label: string;
}

export interface BreakdownFieldOption {
  value: BreakdownField;
  label: string;
  group: string;
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
  private readonly torrentStore = inject(TorrentStoreService);

  readonly icons = { faFloppyDisk, faXmark };

  readonly widgetTypeId = input.required<WidgetTypeId>();
  readonly initialConfig = input.required<WidgetConfigModel>();

  // Every ng-select in this modal is sorted alphabetically by its displayed (translated) label,
  // so the option order stays predictable regardless of catalog/enum declaration order.
  readonly statTileMetrics: ServerMetricId[] = SERVER_METRIC_CATALOG.map((m) => m.id).sort((a, b) =>
    this.translateService
      .instant(`pages.dashboard.widgets.stat-tile.metric.${a}`)
      .localeCompare(
        this.translateService.instant(`pages.dashboard.widgets.stat-tile.metric.${b}`),
      ),
  );

  // Every Torrent field is a valid sort-by / column choice, labeled via the main grid's own
  // translations (see torrent-field-catalog.ts) and sorted alphabetically by that translated
  // label - same approach as the "Visible columns" picker in Settings > Torrent List Grid.
  readonly torrentFieldOptions: TorrentFieldOption[] = TORRENT_FIELD_CATALOG.map((m) => ({
    value: m.field,
    label: this.translateService.instant(m.labelKey),
  })).sort((a, b) => a.label.localeCompare(b.label));

  readonly groupByOptions: PieChartField[] = (
    ['state', 'category', 'tracker', 'save_path'] as PieChartField[]
  ).sort((a, b) =>
    this.translateService
      .instant(`pages.main.grid.grid-lib.col-def.${a}`)
      .localeCompare(this.translateService.instant(`pages.main.grid.grid-lib.col-def.${b}`)),
  );

  readonly sourceOptions: ('metric' | 'torrent-count')[] = (
    ['metric', 'torrent-count'] as ('metric' | 'torrent-count')[]
  ).sort((a, b) =>
    this.translateService
      .instant(`components.modals.widget-config.source-option.${a}`)
      .localeCompare(
        this.translateService.instant(`components.modals.widget-config.source-option.${b}`),
      ),
  );

  // Sorted by group first, then by label within each group, so both the group order and the
  // options inside each group read alphabetically.
  readonly breakdownFieldOptions: BreakdownFieldOption[] = BREAKDOWN_FIELD_CATALOG.map((m) => ({
    value: m.field,
    label: this.translateService.instant(m.labelKey),
    group:
      m.kind === 'categorical'
        ? this.translateService.instant('components.modals.widget-config.field-group.categorical')
        : this.translateService.instant('components.modals.widget-config.field-group.numeric'),
  })).sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));

  readonly config = linkedSignal<WidgetConfigModel>(() => this.initialConfig());

  readonly isStatTile = computed(() => this.widgetTypeId() === 'stat-tile');
  readonly isPieChart = computed(() => this.widgetTypeId() === 'pie-chart');
  readonly isBarChart = computed(() => this.widgetTypeId() === 'bar-chart');
  readonly isActiveDownloads = computed(() => this.widgetTypeId() === 'active-downloads');
  // Narrowed to the { metric } variant - use torrentCountConfig for the 'torrent-count' source.
  readonly statTileConfig = computed(
    () => this.config() as Extract<StatTileConfig, { metric: ServerMetricId }>,
  );
  readonly torrentListConfig = computed(() => this.config() as TorrentListConfig);
  readonly pieChartConfig = computed(() => this.config() as PieChartConfig);
  readonly barChartConfig = computed(() => this.config() as BarChartConfig);
  readonly activeDownloadsConfig = computed(() => this.config() as ActiveDownloadsConfig);

  readonly statTileSource = computed<'metric' | 'torrent-count'>(() =>
    'source' in this.config() ? 'torrent-count' : 'metric',
  );

  readonly torrentCountConfig = computed(
    () => this.config() as Extract<StatTileConfig, { source: 'torrent-count' }>,
  );

  readonly torrentCountValueOptions = computed(() => {
    if (this.statTileSource() !== 'torrent-count') return [];
    return listBreakdownValues(this.torrentStore.torrentsArray(), this.torrentCountConfig().field)
      .map((s) => ({ value: s.key, labelKey: s.labelKey, fallbackLabel: s.key }))
      .sort((a, b) =>
        (a.labelKey ? this.translateService.instant(a.labelKey) : a.fallbackLabel).localeCompare(
          b.labelKey ? this.translateService.instant(b.labelKey) : b.fallbackLabel,
        ),
      );
  });

  readonly widgetLabelKey = computed(() => `pages.dashboard.catalog.${this.widgetTypeId()}`);

  readonly canSave = computed(() => {
    if (this.widgetTypeId() === 'stat-tile') {
      const c = this.config() as StatTileConfig;
      return !('source' in c) || !!c.value;
    }
    if (this.widgetTypeId() === 'active-downloads') {
      const c = this.activeDownloadsConfig();
      return Number.isFinite(c.count) && c.count >= 1;
    }
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

  updateBarChartField(field: BarChartConfig['field']): void {
    this.config.set({ field } satisfies BarChartConfig);
  }

  updateStatTileSource(source: 'metric' | 'torrent-count'): void {
    if (source === 'metric') {
      this.config.set({ metric: 'download_speed' } satisfies StatTileConfig);
      return;
    }
    const field = 'state' as const;
    const firstValue = listBreakdownValues(this.torrentStore.torrentsArray(), field)[0]?.key ?? '';
    this.config.set({ source: 'torrent-count', field, value: firstValue } satisfies StatTileConfig);
  }

  updateTorrentCountField(field: BreakdownField): void {
    const firstValue = listBreakdownValues(this.torrentStore.torrentsArray(), field)[0]?.key ?? '';
    this.config.set({ source: 'torrent-count', field, value: firstValue } satisfies StatTileConfig);
  }

  updateTorrentCountValue(value: string): void {
    const c = this.torrentCountConfig();
    this.config.set({ ...c, value } satisfies StatTileConfig);
  }

  updateActiveDownloadsCount(count: number): void {
    this.config.set({ count } satisfies ActiveDownloadsConfig);
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
