import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseWidget } from 'gridstack/dist/angular';
import { BbProgress } from '../../../../components/bb-progress/bb-progress';
import { ActiveDownloadsData } from '../../../../models/dashboard.model';
import { Torrent } from '../../../../models/torrent.model';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../../../../pipes/humanize-duration-pipe';
import { CommandBusService } from '../../../../services/command-bus.service';
import { WidgetMenu } from '../widget-menu/widget-menu';

// qBittorrent returns 8640000 (100 days) as its "no ETA estimate" sentinel (stalled/queued/no
// peers) - the same threshold breakdown-field-catalog.ts's ETA_BUCKETS uses for its 'unknown'
// bucket.
const ETA_UNKNOWN_THRESHOLD = 8_640_000;

@Component({
  selector: 'app-active-downloads-widget',
  standalone: true,
  imports: [WidgetMenu, TranslatePipe, BbProgress],
  templateUrl: './active-downloads-widget.html',
  styleUrl: './active-downloads-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveDownloadsWidget extends BaseWidget {
  @Input() data!: ActiveDownloadsData;
  @Input() onConfigure?: () => void;
  @Input() onRemove?: () => void;

  private readonly router = inject(Router);
  private readonly commandBus = inject(CommandBusService);
  private readonly filesizePipe = inject(FilesizePipe);
  private readonly humanizeDurationPipe = inject(HumanizeDurationPipe);

  speedLabel(row: Torrent): string | null {
    return row.dlspeed > 0 ? `${this.filesizePipe.transform(row.dlspeed)}/s` : null;
  }

  percentLabel(row: Torrent): string {
    return `${Math.round(row.progress * 100)}%`;
  }

  etaLabel(row: Torrent): string {
    if (row.eta >= ETA_UNKNOWN_THRESHOLD) return '—';
    return this.humanizeDurationPipe.transform(row.eta * 1000, 'narrow', 1);
  }

  openDetails(row: Torrent): void {
    this.commandBus.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash: row.hash });
  }

  viewAll(): void {
    void this.router.navigate(['/pages/torrent-list']);
  }
}
