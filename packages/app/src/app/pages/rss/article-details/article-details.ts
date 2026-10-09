import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUpRightFromSquare, faDownload } from '@fortawesome/free-solid-svg-icons';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { CommandBusService } from '../../../services/command-bus.service';
import { DateFormatService } from '../../../services/date-format.service';
import { ElectronService } from '../../../services/electron.service';
import { RssStoreService } from '../../../services/rss-store.service';

@Component({
  selector: 'app-rss-article-details',
  imports: [FontAwesomeModule, NgbTooltipModule, TranslatePipe],
  templateUrl: './article-details.html',
  styleUrl: './article-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RssArticleDetails {
  private readonly store = inject(RssStoreService);
  private readonly commandBus = inject(CommandBusService);
  private readonly electronService = inject(ElectronService);
  private readonly dateFormatService = inject(DateFormatService);
  private readonly fileSizePipe = inject(FilesizePipe);

  public readonly icons = { faDownload, faArrowUpRightFromSquare };
  public readonly article = this.store.selectedArticle;

  public readonly formattedDate = computed(() => {
    const date = this.article()?.date;
    return date ? this.dateFormatService.format(date.getTime()) : null;
  });

  public readonly sizeLabel = computed(() => {
    const article = this.article();
    if (!article) return null;
    return article.sizeBytes !== null
      ? this.fileSizePipe.transform(article.sizeBytes)
      : article.sizeText;
  });

  public download(): void {
    const url = this.article()?.torrentUrl;
    if (url) this.commandBus.emit({ type: 'UI_ADD_TORRENT', urls: [url] });
  }

  public openLink(): void {
    const link = this.article()?.link;
    if (link) this.electronService.openExternalUrl(link);
  }
}
