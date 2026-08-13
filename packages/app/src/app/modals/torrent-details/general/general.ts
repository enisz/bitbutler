import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgbCollapse, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { QbLogEntry } from '../../../models/qbittorrent.model';
import { FileSizePerSecPipe } from '../../../pipes/filesize-per-sec-pipe';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../../../pipes/humanize-duration-pipe';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { RatioLimitPipe } from '../../../pipes/ratio-limit-pipe';
import { RatioPipe } from '../../../pipes/ratio-pipe';
import { SpeedLimitPipe } from '../../../pipes/speed-limit-pipe';
import { TimeLimitPipe } from '../../../pipes/time-limit-pipe';
import { TorrentDetailsActionsService } from '../torrent-details-actions.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';
import { isDownloadingState } from '../torrent-progress';

@Component({
  selector: 'app-general',
  imports: [
    BbSpinner,
    LocalTimestampPipe,
    TimeagoPipe,
    FilesizePipe,
    FileSizePerSecPipe,
    HumanizeDurationPipe,
    SpeedLimitPipe,
    NgbCollapse,
    NgbTooltip,
    RatioLimitPipe,
    RatioPipe,
    TimeLimitPipe,
    BbPopover,
    TranslatePipe,
    TooltipOverflow,
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class General implements TorrentDetailTabComponent {
  private readonly dataService = inject(TorrentDetailsDataService);
  public readonly actionsService = inject(TorrentDetailsActionsService);

  public readonly torrent = this.dataService.torrent;
  public readonly localPath = this.dataService.localPath;
  public readonly errorLog = this.dataService.errorLog;
  public errorLogExpanded = signal(false);

  public isDownloading(): boolean {
    return isDownloadingState(this.torrent()?.data.state);
  }

  public parseFileErrorReason(message: string): { reason: string; short: string } {
    const match = message.match(/Reason:\s*"(.*)"\s*$/);
    const reason = match ? match[1] : message;
    const errorMatch = reason.match(/error:\s*(.+)$/i);
    const short = errorMatch ? errorMatch[1] : reason;
    return { reason, short };
  }

  public rawLogJson(entry: QbLogEntry): string {
    return JSON.stringify(entry, null, 4);
  }

  public toggleErrorLog(): void {
    this.errorLogExpanded.update((v) => !v);
  }
}
