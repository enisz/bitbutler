import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbCollapse, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbProgressCompact } from '../../../components/bb-progress-compact/bb-progress-compact';
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
    BbProgressCompact,
    NgbCollapse,
    NgbTooltip,
    RatioLimitPipe,
    RatioPipe,
    TimeLimitPipe,
    BbPopover,
    BbBtnContent,
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

  public icons: Record<string, IconDefinition> = { faCheck, faXmark };

  public readonly torrent = this.dataService.torrent;
  public readonly localPath = this.dataService.localPath;
  public readonly errorLog = this.dataService.errorLog;
  public errorLogExpanded = signal(false);

  public readonly progressPercent = computed(() => {
    const p = this.torrent()?.data.progress ?? 0;
    const normalized = p > 0 && p <= 1 ? p * 100 : p;
    return Math.round(normalized);
  });

  public isDownloading(): boolean {
    return (
      this.torrent()?.data.state === 'downloading' ||
      this.torrent()?.data.state === 'pausedDL' ||
      this.torrent()?.data.state === 'stoppedDL' ||
      this.torrent()?.data.state === 'queuedDL' ||
      this.torrent()?.data.state === 'stalledDL' ||
      this.torrent()?.data.state === 'checkingDL' ||
      this.torrent()?.data.state === 'forcedDL'
    );
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
