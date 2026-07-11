import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import { NgbCollapse, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbProgress } from '../../../components/bb-progress/bb-progress';
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
import { ToastService } from '../../../services/toast.service';
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
    BbProgress,
    FontAwesomeModule,
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
  private readonly clipboard = inject(Clipboard);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public icons: Record<string, IconDefinition> = { faCopy };

  public readonly torrent = this.dataService.torrent;
  public readonly localPath = this.dataService.localPath;
  public readonly errorLog = this.dataService.errorLog;
  public errorLogExpanded = signal(false);

  public toClipboard(fieldKey: string, value: string): void {
    const field = this.translateService.instant(
      `components.modals.torrent-details.general.${fieldKey}`,
    );
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.copied-to-clipboard',
        { field },
      ),
    );
    this.clipboard.copy(value);
  }

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
