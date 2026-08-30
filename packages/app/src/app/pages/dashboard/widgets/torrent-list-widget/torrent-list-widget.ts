import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BaseWidget } from 'gridstack/dist/angular';
import { TorrentListData } from '../../../../models/dashboard.model';
import { Torrent } from '../../../../models/torrent.model';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../../../../pipes/humanize-duration-pipe';
import { RatioPipe } from '../../../../pipes/ratio-pipe';
import { TORRENT_FIELD_META_BY_FIELD, TorrentField } from '../../torrent-field-catalog';
import { WidgetMenu } from '../widget-menu/widget-menu';

@Component({
  selector: 'app-torrent-list-widget',
  standalone: true,
  imports: [TranslatePipe, WidgetMenu],
  templateUrl: './torrent-list-widget.html',
  styleUrl: './torrent-list-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentListWidget extends BaseWidget {
  @Input() data!: TorrentListData;
  @Input() onConfigure?: () => void;
  @Input() onRemove?: () => void;

  private readonly ratioPipe = inject(RatioPipe);
  private readonly filesizePipe = inject(FilesizePipe);
  private readonly humanizeDurationPipe = inject(HumanizeDurationPipe);
  private readonly translateService = inject(TranslateService);

  labelKeyFor(column: TorrentField): string {
    return TORRENT_FIELD_META_BY_FIELD[column].labelKey;
  }

  isRightAligned(column: TorrentField): boolean {
    const type = TORRENT_FIELD_META_BY_FIELD[column].type;
    return type !== 'string' && type !== 'state';
  }

  subtitleColumns(): TorrentField[] {
    return this.data.columns.filter((c) => c !== 'name');
  }

  isSortColumn(column: TorrentField): boolean {
    return column === this.data.sortField;
  }

  sortIndicator(): string {
    return this.data.sortOrder === 'asc' ? '▲' : '▼';
  }

  formattedValue(row: Torrent, column: TorrentField): string {
    const value = row[column];
    const meta = TORRENT_FIELD_META_BY_FIELD[column];

    switch (meta.type) {
      case 'string':
        return (value as string) || '-';
      case 'state':
        return String(value);
      case 'integer':
        return String(value);
      case 'decimal':
        return this.ratioPipe.transform(value as number, meta.precision ?? 2);
      case 'percent':
        return `${Math.round((value as number) * 100)}%`;
      case 'bytes':
        return this.filesizePipe.transform(value as number);
      case 'bytesPerSec':
        return `${this.filesizePipe.transform(value as number)}/s`;
      case 'duration':
        return this.humanizeDurationPipe.transform((value as number) * 1000, 'short', 2);
      case 'timestamp':
        return (value as number) > 0
          ? new Date((value as number) * 1000).toLocaleDateString()
          : '-';
      case 'boolean':
        return this.translateService.instant(
          `components.column-filters.boolean.${value ? 'true' : 'false'}`,
        );
    }
  }
}
