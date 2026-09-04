import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseWidget } from 'gridstack/dist/angular';
import { BreakdownField, ServerMetricId, StatTileData } from '../../../../models/dashboard.model';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { RatioPipe } from '../../../../pipes/ratio-pipe';
import { SERVER_METRIC_META_BY_ID } from '../../server-metric-catalog';
import { WidgetMenu } from '../widget-menu/widget-menu';

@Component({
  selector: 'app-stat-tile',
  standalone: true,
  imports: [TranslatePipe, FilesizePipe, RatioPipe, WidgetMenu],
  templateUrl: './stat-tile.html',
  styleUrl: './stat-tile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatTile extends BaseWidget {
  @Input() data!: StatTileData;
  @Input() onConfigure?: () => void;
  @Input() onRemove?: () => void;

  get isTorrentCount(): boolean {
    return 'source' in this.data;
  }

  get metricLabelKey(): string {
    return `pages.dashboard.widgets.stat-tile.metric.${(this.data as { metric: ServerMetricId }).metric}`;
  }

  get torrentCountFieldLabelKey(): string {
    return `pages.main.grid.grid-lib.col-def.${(this.data as { field: BreakdownField }).field}`;
  }

  get torrentCountValueLabelKey(): string | undefined {
    return (this.data as { labelKey?: string }).labelKey;
  }

  get torrentCountValueKey(): string {
    return (this.data as { key: string }).key;
  }

  get total(): number | undefined {
    return 'source' in this.data ? undefined : this.data.total;
  }

  get displayKind(): 'bytes' | 'speed' | 'ratio' | 'count' {
    if ('source' in this.data) return 'count';
    return SERVER_METRIC_META_BY_ID[this.data.metric].displayKind;
  }
}
