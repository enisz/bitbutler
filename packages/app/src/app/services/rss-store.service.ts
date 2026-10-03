import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { RssArticle, RssFeed } from '../models/rss.model';
import { RSS_PATH_SEPARATOR, flattenRssItems } from '../utils/rss.utils';
import { QbService } from './qb.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

const RELOAD_AFTER_REFRESH_MS = 3000;

export type RssFeedRow = RssFeed & { unread: number };

const timeOf = (article: RssArticle): number => article.date?.getTime() ?? Number.NEGATIVE_INFINITY;

const byNewest = (a: RssArticle, b: RssArticle): number => {
  const x = timeOf(a);
  const y = timeOf(b);
  return x === y ? 0 : y > x ? 1 : -1;
};

@Injectable({ providedIn: 'root' })
export class RssStoreService {
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  public readonly feeds = signal<RssFeed[]>([]);
  public readonly articles = signal<RssArticle[]>([]);
  /** `null` selects the virtual "Unread" scope. */
  public readonly selectedFeedPath = signal<string | null>(null);
  public readonly selectedArticleKey = signal<string | null>(null);
  public readonly filterText = signal('');
  /** `null` until the preference has been read. */
  public readonly processingEnabled = signal<boolean | null>(null);
  public readonly loading = signal(false);
  public readonly loaded = signal(false);
  public readonly loadFailed = signal(false);

  public readonly feedRows = computed<RssFeedRow[]>(() => {
    const unread = new Map<string, number>();
    for (const article of this.articles()) {
      if (!article.isRead) unread.set(article.feedPath, (unread.get(article.feedPath) ?? 0) + 1);
    }
    return this.feeds().map((feed) => ({ ...feed, unread: unread.get(feed.path) ?? 0 }));
  });

  public readonly totalUnread = computed(() =>
    this.feedRows().reduce((sum, feed) => sum + feed.unread, 0),
  );

  /** Articles of the selected scope, before the text filter. */
  public readonly scopedArticles = computed<RssArticle[]>(() => {
    const path = this.selectedFeedPath();
    const all = this.articles();
    if (path !== null) return all.filter((a) => a.feedPath === path);
    // Keep the selected item in the list after it is marked read, until the selection moves.
    const selected = this.selectedArticleKey();
    return all.filter((a) => !a.isRead || a.key === selected);
  });

  public readonly visibleArticles = computed<RssArticle[]>(() => {
    const query = this.filterText().trim().toLowerCase();
    const scoped = this.scopedArticles();
    const matching = query
      ? scoped.filter((a) =>
          `${a.title} ${a.description} ${a.author ?? ''}`.toLowerCase().includes(query),
        )
      : scoped;
    return [...matching].sort(byNewest);
  });

  public readonly selectedArticle = computed<RssArticle | null>(() => {
    const key = this.selectedArticleKey();
    return key === null ? null : (this.articles().find((a) => a.key === key) ?? null);
  });

  public async open(): Promise<void> {
    await Promise.all([this.load(), this.loadPreferences()]);
  }

  public async load(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    this.loading.set(true);
    try {
      const items = await this.qbService.rss.items(serverId);
      if (serverId !== this.serverStoreService.currentServerId()) return;

      const { feeds, articles } = flattenRssItems(items);
      this.feeds.set(feeds);
      this.articles.set(articles);
      this.loaded.set(true);
      this.loadFailed.set(false);
      this.reconcileSelection();
    } catch (error: unknown) {
      const firstFailure = !this.loadFailed();
      this.loadFailed.set(true);
      if (firstFailure) this.toastError(error, 'pages.rss.toast.load-failed');
    } finally {
      this.loading.set(false);
    }
  }

  public reset(): void {
    this.clearReloadTimer();
    this.feeds.set([]);
    this.articles.set([]);
    this.selectedFeedPath.set(null);
    this.selectedArticleKey.set(null);
    this.filterText.set('');
    this.processingEnabled.set(null);
    this.loading.set(false);
    this.loaded.set(false);
    this.loadFailed.set(false);
  }

  public selectFeed(path: string | null): void {
    this.selectedFeedPath.set(path);
    this.selectedArticleKey.set(null);
  }

  public async selectArticle(article: RssArticle): Promise<void> {
    this.selectedArticleKey.set(article.key);
    if (!article.isRead) await this.markRead(article);
  }

  public async markRead(article: RssArticle): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    this.setRead(article.key, true);
    try {
      await this.qbService.rss.markAsRead(serverId, article.feedPath, article.id);
    } catch (error: unknown) {
      this.setRead(article.key, false);
      this.toastError(error, 'pages.rss.toast.read-failed');
    }
  }

  public async markAllRead(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const selected = this.selectedFeedPath();
    const paths =
      selected === null
        ? [
            ...new Set(
              this.articles()
                .filter((a) => !a.isRead)
                .map((a) => a.feedPath),
            ),
          ]
        : [selected];
    if (paths.length === 0) return;

    const targets = new Set(paths);
    this.articles.update((list) =>
      list.map((a) => (targets.has(a.feedPath) ? { ...a, isRead: true } : a)),
    );
    try {
      await Promise.all(paths.map((path) => this.qbService.rss.markAsRead(serverId, path)));
    } catch (error: unknown) {
      this.toastError(error, 'pages.rss.toast.read-failed');
      await this.load();
    }
  }

  public async addFeed(url: string, name?: string): Promise<boolean> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return false;

    const feedUrl = url.trim();
    const feedName = name?.trim() || undefined;
    try {
      await this.qbService.rss.addFeed(serverId, feedUrl, feedName);
      this.toastSuccess(`"${feedName ?? feedUrl}"`, 'pages.rss.toast.added');
      await this.load();
      return true;
    } catch (error: unknown) {
      this.toastError(error, 'pages.rss.toast.add-failed');
      return false;
    }
  }

  public async removeFeed(feed: RssFeed): Promise<boolean> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return false;

    try {
      await this.qbService.rss.removeItem(serverId, feed.path);
      if (this.selectedFeedPath() === feed.path) this.selectFeed(null);
      this.toastSuccess(`"${feed.name}"`, 'pages.rss.toast.removed');
      await this.load();
      return true;
    } catch (error: unknown) {
      this.toastError(error, 'pages.rss.toast.remove-failed');
      return false;
    }
  }

  public async renameFeed(feed: RssFeed, newName: string): Promise<boolean> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return false;

    const name = newName.trim();
    const destPath = [...feed.path.split(RSS_PATH_SEPARATOR).slice(0, -1), name].join(
      RSS_PATH_SEPARATOR,
    );
    try {
      await this.qbService.rss.moveItem(serverId, feed.path, destPath);
      if (this.selectedFeedPath() === feed.path) this.selectedFeedPath.set(destPath);
      this.toastSuccess(`"${name}"`, 'pages.rss.toast.renamed');
      await this.load();
      return true;
    } catch (error: unknown) {
      this.toastError(error, 'pages.rss.toast.rename-failed');
      return false;
    }
  }

  public async refresh(feed?: RssFeed): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const paths = feed ? [feed.path] : this.feeds().map((f) => f.path);
    try {
      await Promise.all(paths.map((path) => this.qbService.rss.refreshItem(serverId, path)));
    } catch (error: unknown) {
      this.toastError(error, 'pages.rss.toast.refresh-failed');
      return;
    }
    await this.load();
    // qB fetches feeds asynchronously; look again shortly so fresh items show up.
    this.clearReloadTimer();
    this.reloadTimer = setTimeout(() => void this.load(), RELOAD_AFTER_REFRESH_MS);
  }

  public async enableProcessing(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    try {
      await this.qbService.app.setPreferences(serverId, { rss_processing_enabled: true });
      this.processingEnabled.set(true);
      this.toastSuccess(
        this.translateService.instant('pages.rss.toast.enabled-message'),
        'pages.rss.toast.enabled',
      );
      await this.load();
    } catch (error: unknown) {
      this.toastError(error, 'pages.rss.toast.enable-failed');
    }
  }

  private async loadPreferences(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    try {
      const prefs = await this.qbService.app.preferences(serverId);
      if (serverId === this.serverStoreService.currentServerId()) {
        this.processingEnabled.set(prefs.rss_processing_enabled);
      }
    } catch {
      // The "disabled" banner just stays hidden; load() already reports connectivity problems.
    }
  }

  private setRead(key: string, isRead: boolean): void {
    this.articles.update((list) => list.map((a) => (a.key === key ? { ...a, isRead } : a)));
  }

  private reconcileSelection(): void {
    const path = this.selectedFeedPath();
    if (path !== null && !this.feeds().some((f) => f.path === path))
      this.selectedFeedPath.set(null);

    const key = this.selectedArticleKey();
    if (key !== null && !this.articles().some((a) => a.key === key)) {
      this.selectedArticleKey.set(null);
    }
  }

  private clearReloadTimer(): void {
    if (this.reloadTimer !== null) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
  }

  private toastSuccess(message: string, titleKey: string): void {
    this.toastService.success(message, this.translateService.instant(titleKey));
  }

  private toastError(error: unknown, titleKey: string): void {
    this.toastService.danger(
      error instanceof Error ? error.message : String(error),
      this.translateService.instant(titleKey),
    );
  }
}
