import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RssArticle } from '../../../models/rss.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { RssStoreService } from '../../../services/rss-store.service';
import { RssArticleList } from './article-list';

const article = (id: string, over: Partial<RssArticle> = {}): RssArticle => ({
  key: `Feed\u0000${id}`,
  id,
  feedPath: 'Feed',
  title: `Title ${id}`,
  chip: null,
  date: new Date(Date.now() - 3 * 3_600_000),
  author: null,
  link: null,
  description: '',
  sizeBytes: null,
  sizeText: null,
  isRead: false,
  torrentUrl: `https://x/${id}.torrent`,
  ...over,
});

describe('RssArticleList', () => {
  let fixture: ComponentFixture<RssArticleList>;
  let store: any;
  let commandBus: { emit: ReturnType<typeof vi.fn> };

  const setup = async (articles: RssArticle[], over: Record<string, unknown> = {}) => {
    store = {
      visibleArticles: signal(articles),
      scopedArticles: signal(articles),
      selectedArticleKey: signal<string | null>(null),
      feeds: signal([{ path: 'Feed' }]),
      loaded: signal(true),
      loadFailed: signal(false),
      selectArticle: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      ...over,
    };
    commandBus = { emit: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RssArticleList],
      providers: [
        { provide: RssStoreService, useValue: store },
        { provide: CommandBusService, useValue: commandBus },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RssArticleList);
    fixture.detectChanges();
  };

  const items = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.rss-item')) as HTMLElement[];

  it('renders one row per article with chip, title and age', async () => {
    await setup([article('a', { chip: 'Distribution' }), article('b')]);

    expect(items()).toHaveLength(2);
    expect(items()[0].querySelector('.rss-item__chip')?.textContent?.trim()).toBe('Distribution');
    expect(items()[0].querySelector('.rss-item__title')?.textContent?.trim()).toBe('Title a');
    expect(items()[1].querySelector('.rss-item__chip')).toBeNull();
    expect(items()[0].querySelector('.rss-item__age')?.textContent).toContain('pages.rss.age.hour');
  });

  it('styles unread rows and highlights the selected one', async () => {
    await setup([article('a'), article('b', { isRead: true })]);
    store.selectedArticleKey.set('Feed\u0000b');
    fixture.detectChanges();

    expect(items()[0].classList).toContain('rss-item--unread');
    expect(items()[1].classList).not.toContain('rss-item--unread');
    expect(items()[1].classList).toContain('rss-item--active');
  });

  it('selects an article on click', async () => {
    const a = article('a');
    await setup([a]);

    items()[0].click();

    expect(store.selectArticle).toHaveBeenCalledWith(a);
  });

  it('starts the download flow on double click when a torrent url exists', async () => {
    await setup([article('a')]);

    items()[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(commandBus.emit).toHaveBeenCalledWith({
      type: 'UI_ADD_TORRENT',
      urls: ['https://x/a.torrent'],
    });
  });

  it('ignores double click on items that are not downloadable', async () => {
    await setup([article('a', { torrentUrl: null })]);

    items()[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(commandBus.emit).not.toHaveBeenCalled();
  });

  it('shows the shown/total count', async () => {
    await setup([article('a')], { scopedArticles: signal([article('a'), article('b')]) });
    expect(fixture.nativeElement.querySelector('.rss-items__count').textContent).toContain(
      'pages.rss.items.count',
    );
  });

  it('explains an empty list depending on the state', async () => {
    await setup([], { feeds: signal([]) });
    expect(fixture.nativeElement.querySelector('.rss-items__empty').textContent).toContain(
      'pages.rss.empty.no-feeds',
    );

    store.feeds.set([{ path: 'Feed' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.rss-items__empty').textContent).toContain(
      'pages.rss.items.empty',
    );
  });

  it('shows nothing while the first load is still running', async () => {
    await setup([], { loaded: signal(false) });
    expect(fixture.nativeElement.querySelector('.rss-items__empty')).toBeNull();
  });

  it('offers a retry when loading failed', async () => {
    await setup([], { loadFailed: signal(true) });
    const empty = fixture.nativeElement.querySelector('.rss-items__empty') as HTMLElement;
    expect(empty.textContent).toContain('pages.rss.empty.load-failed');

    (empty.querySelector('button') as HTMLButtonElement).click();
    expect(store.load).toHaveBeenCalled();
  });
});
