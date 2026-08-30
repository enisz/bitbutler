import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseWidget } from 'gridstack/dist/angular';
import { StatTileData } from '../../../../models/dashboard.model';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { RatioPipe } from '../../../../pipes/ratio-pipe';
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

  get labelKey(): string {
    return `pages.dashboard.widgets.stat-tile.metric.${this.data.metric}`;
  }

  get displayKind(): 'bytes' | 'speed' | 'ratio' | 'count' {
    switch (this.data.metric) {
      case 'download_speed':
      case 'upload_speed':
        return 'speed';
      case 'free_disk_space':
        return 'bytes';
      case 'global_ratio':
        return 'ratio';
      case 'active_count':
        return 'count';
    }
  }
}
