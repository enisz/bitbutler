import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { RssFeedRow, RssStoreService } from '../../../services/rss-store.service';
import { RssFeedList } from './feed-list';

const row = (path: string, unread: number, over: Partial<RssFeedRow> = {}): RssFeedRow => ({
  path,
  name: path.split('\\').pop()!,
  url: `https://${path}/rss`,
  isLoading: false,
  hasError: false,
  unread,
  ...over,
});

describe('RssFeedList', () => {
  let fixture: ComponentFixture<RssFeedList>;
  let component: RssFeedList;
  let store: any;
  let commandBus: { emit: ReturnType<typeof vi.fn> };
  let confirmService: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    store = {
      feedRows: signal([row('Alpha', 2), row('Folder\\Beta', 0, { hasError: true })]),
      totalUnread: signal(2),
      selectedFeedPath: signal<string | null>(null),
      selectFeed: vi.fn(),
      refresh: vi.fn().mockResolvedValue(undefined),
      removeFeed: vi.fn().mockResolvedValue(true),
    };
    commandBus = { emit: vi.fn() };
    confirmService = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [RssFeedList],
      providers: [
        { provide: RssStoreService, useValue: store },
        { provide: CommandBusService, useValue: commandBus },
        { provide: ConfirmService, useValue: confirmService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RssFeedList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const rows = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.rss-feed')) as HTMLElement[];

  it('renders the Unread row first, then one row per feed with its unread count', () => {
    expect(rows()).toHaveLength(3);
    expect(rows()[0].textContent).toContain('pages.rss.feeds.unread');
    expect(rows()[0].querySelector('.rss-feed__badge')?.textContent?.trim()).toBe('2');
    expect(rows()[1].textContent).toContain('Alpha');
    expect(rows()[2].textContent).toContain('Beta');
  });

  it('marks the selected row active', () => {
    expect(rows()[0].classList).toContain('rss-feed--active');

    store.selectedFeedPath.set('Alpha');
    fixture.detectChanges();

    expect(rows()[0].classList).not.toContain('rss-feed--active');
    expect(rows()[1].classList).toContain('rss-feed--active');
  });

  it('selects Unread (null) and feeds by path when clicked', () => {
    (rows()[1].querySelector('.rss-feed__main') as HTMLButtonElement).click();
    expect(store.selectFeed).toHaveBeenCalledWith('Alpha');

    (rows()[0].querySelector('.rss-feed__main') as HTMLButtonElement).click();
    expect(store.selectFeed).toHaveBeenCalledWith(null);
  });

  it('shows an error marker for feeds that failed to update', () => {
    expect(rows()[2].querySelector('.rss-feed__error')).not.toBeNull();
    expect(rows()[1].querySelector('.rss-feed__error')).toBeNull();
  });

  it('refreshes a single feed', () => {
    const feed = store.feedRows()[0];
    component.refresh(feed);
    expect(store.refresh).toHaveBeenCalledWith(feed);
  });

  it('asks the command bus to rename a feed', () => {
    const feed = store.feedRows()[0];
    component.rename(feed);
    expect(commandBus.emit).toHaveBeenCalledWith({ type: 'UI_RSS_RENAME_SUBSCRIPTION', feed });
  });

  it('removes a feed only after confirmation', async () => {
    const feed = store.feedRows()[0];

    await component.remove(feed);
    expect(confirmService.confirm).toHaveBeenCalledWith(
      'pages.rss.remove-confirm.title',
      { text: 'pages.rss.remove-confirm.message', data: { name: 'Alpha' } },
      'general.button.delete',
      undefined,
      undefined,
      expect.anything(),
    );
    expect(store.removeFeed).toHaveBeenCalledWith(feed);

    store.removeFeed.mockClear();
    confirmService.confirm.mockResolvedValue(false);
    await component.remove(feed);
    expect(store.removeFeed).not.toHaveBeenCalled();
  });
});
