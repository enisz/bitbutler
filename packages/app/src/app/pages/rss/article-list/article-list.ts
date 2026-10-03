import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { interval } from 'rxjs';
import { RssArticle } from '../../../models/rss.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { RssStoreService } from '../../../services/rss-store.service';
import { relativeAge } from '../../../utils/rss.utils';

const AGE_REFRESH_MS = 60_000;

@Component({
  selector: 'app-rss-article-list',
  imports: [TranslatePipe],
  templateUrl: './article-list.html',
  styleUrl: './article-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RssArticleList {
  private readonly store = inject(RssStoreService);
  private readonly commandBus = inject(CommandBusService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly now = signal(Date.now());

  public readonly articles = this.store.visibleArticles;
  public readonly selectedKey = this.store.selectedArticleKey;
  public readonly loadFailed = this.store.loadFailed;
  public readonly total = computed(() => this.store.scopedArticles().length);

  /** Translation key explaining an empty list, or `null` while the first load is running. */
  public readonly emptyKey = computed<string | null>(() => {
    if (this.store.loadFailed()) return 'pages.rss.empty.load-failed';
    if (!this.store.loaded()) return null;
    if (this.store.feeds().length === 0) return 'pages.rss.empty.no-feeds';
    return 'pages.rss.items.empty';
  });

  constructor() {
    interval(AGE_REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));
  }

  public select(article: RssArticle): void {
    void this.store.selectArticle(article);
  }

  public download(article: RssArticle): void {
    if (!article.torrentUrl) return;
    this.commandBus.emit({ type: 'UI_ADD_TORRENT', urls: [article.torrentUrl] });
  }

  public retry(): void {
    void this.store.load();
  }

  public ageLabel(article: RssArticle): string {
    const age = relativeAge(article.date, this.now());
    return age
      ? this.translateService.instant(`pages.rss.age.${age.unit}`, { value: age.value })
      : '';
  }
}
