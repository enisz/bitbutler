import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QbService } from './qb.service';
import { RssStoreService } from './rss-store.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

const art = (id: string, title: string, date: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  date,
  link: `https://x/${id}`,
  torrentURL: `https://x/${id}`,
  description: `desc ${id}`,
  author: 'auth',
  ...extra,
});

const makeItems = () => ({
  'Feed A': {
    uid: '{1}',
    url: 'https://a/rss',
    articles: [
      art('a1', '[Distribution] - Kali', '18 Sep 2026 22:00:00 +0000'),
      art('a2', 'Debian', '17 Sep 2026 22:00:00 +0000', { isRead: true }),
    ],
  },
  Folder: {
    'Feed B': {
      uid: '{2}',
      url: 'https://b/rss',
      articles: [art('b1', 'Fedora', '18 Sep 2026 23:00:00 +0000', { author: 'Zed' })],
    },
  },
});

describe('RssStoreService', () => {
  let store: RssStoreService;
  let qb: any;
  let toast: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
  let serverId: WritableSignal<string | null>;

  beforeEach(() => {
    qb = {
      rss: {
        items: vi.fn().mockImplementation(() => Promise.resolve(makeItems())),
        addFeed: vi.fn().mockResolvedValue(undefined),
        removeItem: vi.fn().mockResolvedValue(undefined),
        moveItem: vi.fn().mockResolvedValue(undefined),
        refreshItem: vi.fn().mockResolvedValue(undefined),
        markAsRead: vi.fn().mockResolvedValue(undefined),
      },
      app: {
        preferences: vi.fn().mockResolvedValue({ rss_processing_enabled: true }),
        setPreferences: vi.fn().mockResolvedValue(undefined),
      },
    };
    toast = { success: vi.fn(), danger: vi.fn() };
    serverId = signal<string | null>('server-1');

    TestBed.configureTestingModule({
      providers: [
        { provide: QbService, useValue: qb },
        { provide: ServerStoreService, useValue: { currentServerId: serverId } },
        { provide: ToastService, useValue: toast },
      ],
    });
    store = TestBed.inject(RssStoreService);
  });

  const article = (id: string) => store.articles().find((a) => a.id === id)!;

  describe('loading', () => {
    it('flattens the tree and counts unread per feed', async () => {
      await store.load();

      expect(store.feedRows().map((f) => [f.path, f.unread])).toEqual([
        ['Feed A', 1],
        ['Folder\\Feed B', 1],
      ]);
      expect(store.totalUnread()).toBe(2);
      expect(store.loaded()).toBe(true);
    });

    it('does nothing without a server', async () => {
      serverId.set(null);
      await store.load();
      expect(qb.rss.items).not.toHaveBeenCalled();
    });

    it('open() also reads the processing preference', async () => {
      qb.app.preferences.mockResolvedValue({ rss_processing_enabled: false });
      await store.open();
      expect(store.processingEnabled()).toBe(false);
    });

    it('toasts only on the first consecutive load failure', async () => {
      qb.rss.items.mockRejectedValue(new Error('offline'));

      await store.load();
      await store.load();

      expect(store.loadFailed()).toBe(true);
      expect(toast.danger).toHaveBeenCalledTimes(1);
      expect(toast.danger).toHaveBeenCalledWith('offline', 'pages.rss.toast.load-failed');
    });

    it('clears everything on reset()', async () => {
      await store.open();
      store.filterText.set('x');
      store.reset();

      expect(store.feeds()).toEqual([]);
      expect(store.articles()).toEqual([]);
      expect(store.filterText()).toBe('');
      expect(store.processingEnabled()).toBeNull();
      expect(store.loaded()).toBe(false);
    });
  });

  describe('scopes and filtering', () => {
    beforeEach(async () => {
      await store.load();
    });

    it('shows unread articles newest first in the Unread scope', () => {
      expect(store.selectedFeedPath()).toBeNull();
      expect(store.visibleArticles().map((a) => a.id)).toEqual(['b1', 'a1']);
    });

    it('shows every article of the selected feed', () => {
      store.selectFeed('Feed A');
      expect(store.visibleArticles().map((a) => a.id)).toEqual(['a1', 'a2']);
    });

    it('keeps the selected article visible in Unread after it is marked read', async () => {
      await store.selectArticle(article('a1'));
      expect(article('a1').isRead).toBe(true);
      expect(store.visibleArticles().map((a) => a.id)).toContain('a1');

      await store.selectArticle(article('b1'));
      expect(store.visibleArticles().map((a) => a.id)).toEqual(['b1']);
    });

    it('filters on title, author and description, case-insensitively', () => {
      store.filterText.set('KALI');
      expect(store.visibleArticles().map((a) => a.id)).toEqual(['a1']);

      store.filterText.set('zed');
      expect(store.visibleArticles().map((a) => a.id)).toEqual(['b1']);

      store.filterText.set('desc a1');
      expect(store.visibleArticles().map((a) => a.id)).toEqual(['a1']);
    });

    it('exposes the selected article', async () => {
      await store.selectArticle(article('b1'));
      expect(store.selectedArticle()?.id).toBe('b1');
    });

    it('drops the article selection when the feed selection changes', async () => {
      await store.selectArticle(article('b1'));
      store.selectFeed('Feed A');
      expect(store.selectedArticle()).toBeNull();
    });
  });

  describe('read state', () => {
    beforeEach(async () => {
      await store.load();
    });

    it('marks an article read optimistically and tells qB', async () => {
      const pending = store.markRead(article('a1'));
      expect(article('a1').isRead).toBe(true);
      await pending;

      expect(qb.rss.markAsRead).toHaveBeenCalledWith('server-1', 'Feed A', 'a1');
    });

    it('reverts and toasts when qB rejects', async () => {
      qb.rss.markAsRead.mockRejectedValue(new Error('nope'));

      await store.markRead(article('a1'));

      expect(article('a1').isRead).toBe(false);
      expect(toast.danger).toHaveBeenCalledWith('nope', 'pages.rss.toast.read-failed');
    });

    it('does not call qB when selecting an already read article', async () => {
      await store.selectArticle(article('a2'));
      expect(qb.rss.markAsRead).not.toHaveBeenCalled();
    });

    it('marks only the selected feed read', async () => {
      store.selectFeed('Feed A');
      await store.markAllRead();

      expect(qb.rss.markAsRead).toHaveBeenCalledTimes(1);
      expect(qb.rss.markAsRead).toHaveBeenCalledWith('server-1', 'Feed A');
      expect(article('a1').isRead).toBe(true);
      expect(article('b1').isRead).toBe(false);
    });

    it('marks every feed with unread items read from the Unread scope', async () => {
      await store.markAllRead();

      expect(qb.rss.markAsRead).toHaveBeenCalledTimes(2);
      expect(qb.rss.markAsRead).toHaveBeenCalledWith('server-1', 'Feed A');
      expect(qb.rss.markAsRead).toHaveBeenCalledWith('server-1', 'Folder\\Feed B');
      expect(store.totalUnread()).toBe(0);
    });

    it('reloads and toasts when mark-all-read fails', async () => {
      qb.rss.markAsRead.mockRejectedValue(new Error('boom'));
      qb.rss.items.mockClear();

      await store.markAllRead();

      expect(toast.danger).toHaveBeenCalledWith('boom', 'pages.rss.toast.read-failed');
      expect(qb.rss.items).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscriptions', () => {
    beforeEach(async () => {
      await store.load();
      qb.rss.items.mockClear();
    });

    it('addFeed() passes a trimmed name, toasts and reloads', async () => {
      const ok = await store.addFeed(' https://c/rss ', ' Cee ');

      expect(ok).toBe(true);
      expect(qb.rss.addFeed).toHaveBeenCalledWith('server-1', 'https://c/rss', 'Cee');
      expect(toast.success).toHaveBeenCalledWith('"Cee"', 'pages.rss.toast.added');
      expect(qb.rss.items).toHaveBeenCalledTimes(1);
    });

    it('addFeed() omits an empty name and quotes the url instead', async () => {
      await store.addFeed('https://c/rss', '   ');

      expect(qb.rss.addFeed).toHaveBeenCalledWith('server-1', 'https://c/rss', undefined);
      expect(toast.success).toHaveBeenCalledWith('"https://c/rss"', 'pages.rss.toast.added');
    });

    it('addFeed() returns false and toasts the error on failure', async () => {
      qb.rss.addFeed.mockRejectedValue(new Error('exists'));

      expect(await store.addFeed('https://c/rss')).toBe(false);
      expect(toast.danger).toHaveBeenCalledWith('exists', 'pages.rss.toast.add-failed');
    });

    it('removeFeed() resets the selection when the removed feed was selected', async () => {
      store.selectFeed('Feed A');
      const feed = store.feeds().find((f) => f.path === 'Feed A')!;

      expect(await store.removeFeed(feed)).toBe(true);

      expect(qb.rss.removeItem).toHaveBeenCalledWith('server-1', 'Feed A');
      expect(store.selectedFeedPath()).toBeNull();
      expect(toast.success).toHaveBeenCalledWith('"Feed A"', 'pages.rss.toast.removed');
    });

    it('renameFeed() keeps the parent folder in the destination path', async () => {
      store.selectFeed('Folder\\Feed B');
      const feed = store.feeds().find((f) => f.path === 'Folder\\Feed B')!;

      expect(await store.renameFeed(feed, ' Renamed ')).toBe(true);

      expect(qb.rss.moveItem).toHaveBeenCalledWith('server-1', 'Folder\\Feed B', 'Folder\\Renamed');
      expect(toast.success).toHaveBeenCalledWith('"Renamed"', 'pages.rss.toast.renamed');
    });

    it('renameFeed() reports failures', async () => {
      qb.rss.moveItem.mockRejectedValue(new Error('taken'));
      const feed = store.feeds()[0];

      expect(await store.renameFeed(feed, 'X')).toBe(false);
      expect(toast.danger).toHaveBeenCalledWith('taken', 'pages.rss.toast.rename-failed');
    });
  });

  describe('refresh and processing', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('refreshes every feed, reloads now and once more shortly after', async () => {
      vi.useFakeTimers();
      await store.load();
      qb.rss.items.mockClear();

      await store.refresh();

      expect(qb.rss.refreshItem).toHaveBeenCalledWith('server-1', 'Feed A');
      expect(qb.rss.refreshItem).toHaveBeenCalledWith('server-1', 'Folder\\Feed B');
      expect(qb.rss.items).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(3000);
      expect(qb.rss.items).toHaveBeenCalledTimes(2);
    });

    it('refreshes a single feed', async () => {
      await store.load();
      await store.refresh(store.feeds()[0]);
      expect(qb.rss.refreshItem).toHaveBeenCalledTimes(1);
      expect(qb.rss.refreshItem).toHaveBeenCalledWith('server-1', 'Feed A');
    });

    it('toasts and skips the reload when refreshing fails', async () => {
      await store.load();
      qb.rss.items.mockClear();
      qb.rss.refreshItem.mockRejectedValue(new Error('down'));

      await store.refresh();

      expect(toast.danger).toHaveBeenCalledWith('down', 'pages.rss.toast.refresh-failed');
      expect(qb.rss.items).not.toHaveBeenCalled();
    });

    it('enableProcessing() sets the preference, updates the flag and reloads', async () => {
      store.processingEnabled.set(false);

      await store.enableProcessing();

      expect(qb.app.setPreferences).toHaveBeenCalledWith('server-1', {
        rss_processing_enabled: true,
      });
      expect(store.processingEnabled()).toBe(true);
      expect(toast.success).toHaveBeenCalledWith(
        'pages.rss.toast.enabled-message',
        'pages.rss.toast.enabled',
      );
    });

    it('enableProcessing() toasts when the preference cannot be saved', async () => {
      store.processingEnabled.set(false);
      qb.app.setPreferences.mockRejectedValue(new Error('denied'));

      await store.enableProcessing();

      expect(store.processingEnabled()).toBe(false);
      expect(toast.danger).toHaveBeenCalledWith('denied', 'pages.rss.toast.enable-failed');
    });
  });
});
