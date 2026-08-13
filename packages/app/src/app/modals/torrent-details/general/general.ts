import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faChevronDown,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { NgbCollapse, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { QbLogEntry } from '../../../models/qbittorrent.model';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../../../pipes/humanize-duration-pipe';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { RatioLimitPipe } from '../../../pipes/ratio-limit-pipe';
import { SpeedLimitPipe } from '../../../pipes/speed-limit-pipe';
import { TimeLimitPipe } from '../../../pipes/time-limit-pipe';
import { TorrentDetailsHero } from '../hero/hero';
import { TorrentDetailsActionsService } from '../torrent-details-actions.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';
import { isDownloadingState } from '../torrent-progress';

@Component({
  selector: 'app-general',
  imports: [
    BbSpinner,
    FontAwesomeModule,
    LocalTimestampPipe,
    TimeagoPipe,
    FilesizePipe,
    HumanizeDurationPipe,
    SpeedLimitPipe,
    NgbCollapse,
    NgbTooltip,
    RatioLimitPipe,
    TimeLimitPipe,
    BbPopover,
    TranslatePipe,
    TooltipOverflow,
    TorrentDetailsHero,
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

  public icons: Record<string, IconDefinition> = {
    faTriangleExclamation,
    faChevronDown,
  };

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

  public onOptionToggle(event: Event, current: boolean, action: () => void): void {
    (event.target as HTMLInputElement).checked = current;
    action();
  }

  public onAutoTmmToggle(event: Event): void {
    this.onOptionToggle(event, this.torrent()!.data.auto_tmm, () =>
      this.actionsService.toggleAutoTmm(),
    );
  }

  public onSequentialDownloadToggle(event: Event): void {
    this.onOptionToggle(event, this.torrent()!.data.seq_dl, () =>
      this.actionsService.toggleSequentialDownload(),
    );
  }

  public onForceStartToggle(event: Event): void {
    this.onOptionToggle(event, this.torrent()!.data.force_start, () =>
      this.actionsService.toggleForceStart(),
    );
  }

  public onSuperSeedingToggle(event: Event): void {
    this.onOptionToggle(event, this.torrent()!.data.super_seeding, () =>
      this.actionsService.toggleSuperSeeding(),
    );
  }

  public onFirstLastPiecePrioToggle(event: Event): void {
    this.onOptionToggle(event, this.torrent()!.data.f_l_piece_prio, () =>
      this.actionsService.toggleFirstLastPiecePrio(),
    );
  }
}
