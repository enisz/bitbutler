import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { heroStatusLabelKey } from './hero-status-label';

@Component({
  selector: 'app-torrent-details-title',
  imports: [TranslatePipe, TimeagoPipe, FilesizePipe, NgbTooltip, TooltipOverflow],
  templateUrl: './title.html',
  styleUrl: './title.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentDetailsTitle {
  private readonly dataService = inject(TorrentDetailsDataService);

  public readonly torrent = this.dataService.torrent;

  public readonly statusLabelKey = computed(() => heroStatusLabelKey(this.torrent()?.data.state));
}
