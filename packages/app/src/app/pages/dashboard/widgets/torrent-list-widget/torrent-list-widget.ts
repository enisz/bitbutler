import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseWidget } from 'gridstack/dist/angular';
import {
  TorrentListColumn,
  TorrentListData,
  TorrentListRow,
} from '../../../../models/dashboard.model';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../../../../pipes/humanize-duration-pipe';
import { RatioPipe } from '../../../../pipes/ratio-pipe';
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
  @Input() editMode = false;
  @Input() onConfigure!: () => void;
  @Input() onRemove!: () => void;

  private readonly ratioPipe = inject(RatioPipe);
  private readonly filesizePipe = inject(FilesizePipe);
  private readonly humanizeDurationPipe = inject(HumanizeDurationPipe);

  formattedValue(row: TorrentListRow, column: TorrentListColumn): string {
    switch (column) {
      case 'name':
        return row.name;
      case 'state':
        return row.state;
      case 'category':
        return row.category || '-';
      case 'ratio':
        return this.ratioPipe.transform(row.ratio);
      case 'dlspeed':
        return `${this.filesizePipe.transform(row.dlspeed)}/s`;
      case 'upspeed':
        return `${this.filesizePipe.transform(row.upspeed)}/s`;
      case 'size':
        return this.filesizePipe.transform(row.size);
      case 'progress':
        return `${Math.round(row.progress * 100)}%`;
      case 'added_on':
        return row.added_on ? new Date(row.added_on * 1000).toLocaleDateString() : '-';
      case 'eta':
        return this.humanizeDurationPipe.transform(row.eta * 1000, 'short', 2);
    }
  }
}
