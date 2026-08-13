import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { ToastService } from '../../../services/toast.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';

@Component({
  selector: 'app-torrent-details-title',
  imports: [
    TranslatePipe,
    TimeagoPipe,
    FilesizePipe,
    NgbTooltip,
    TooltipOverflow,
    FontAwesomeModule,
  ],
  templateUrl: './title.html',
  styleUrl: './title.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentDetailsTitle {
  private readonly dataService = inject(TorrentDetailsDataService);
  private readonly clipboard = inject(Clipboard);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public readonly icon = { faCopy };

  public readonly torrent = this.dataService.torrent;

  public readonly infoHash = computed(
    () => this.torrent()?.data.infohash_v1 || this.torrent()?.data.infohash_v2 || '',
  );

  public copyInfoHash(): void {
    const hash = this.infoHash();
    if (!hash) return;

    this.clipboard.copy(hash);
    this.toastService.info(
      this.translateService.instant('pages.main.grid.context-menu.toast.copied-to-clipboard', {
        field: this.translateService.instant('pages.main.grid.context-menu.field.info-hash'),
      }),
    );
  }
}
