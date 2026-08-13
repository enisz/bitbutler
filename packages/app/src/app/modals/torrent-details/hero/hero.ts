import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BbProgressCompact } from '../../../components/bb-progress-compact/bb-progress-compact';
import { FileSizePerSecPipe } from '../../../pipes/filesize-per-sec-pipe';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../../../pipes/humanize-duration-pipe';
import { RatioLimitPipe } from '../../../pipes/ratio-limit-pipe';
import { RatioPipe } from '../../../pipes/ratio-pipe';
import { SpeedLimitPipe } from '../../../pipes/speed-limit-pipe';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { isDownloadingState, normalizeProgressPercent } from '../torrent-progress';
import { heroStatusLabelKey } from './hero-status-label';

@Component({
  selector: 'app-torrent-details-hero',
  imports: [
    TranslatePipe,
    FilesizePipe,
    FileSizePerSecPipe,
    HumanizeDurationPipe,
    SpeedLimitPipe,
    RatioPipe,
    RatioLimitPipe,
    BbProgressCompact,
  ],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentDetailsHero {
  private readonly dataService = inject(TorrentDetailsDataService);

  public readonly torrent = this.dataService.torrent;

  public readonly progressPercent = computed(() =>
    normalizeProgressPercent(this.torrent()?.data.progress),
  );

  public readonly isDownloading = computed(() => isDownloadingState(this.torrent()?.data.state));

  public readonly statusLabelKey = computed(() => heroStatusLabelKey(this.torrent()?.data.state));
}
