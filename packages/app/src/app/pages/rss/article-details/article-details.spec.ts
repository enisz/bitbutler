import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RssArticle } from '../../../models/rss.model';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { CommandBusService } from '../../../services/command-bus.service';
import { DateFormatService } from '../../../services/date-format.service';
import { ElectronService } from '../../../services/electron.service';
import { RssStoreService } from '../../../services/rss-store.service';
import { RssArticleDetails } from './article-details';

const article = (over: Partial<RssArticle> = {}): RssArticle => ({
  key: 'Feed\u0000a',
  id: 'a',
  feedPath: 'Feed',
  title: 'Kali Linux',
  chip: 'Distribution',
  date: new Date('2026-09-18T22:00:00Z'),
  author: '@FossTorrents',
  link: 'https://example.com/kali',
  description: 'Kali has been released.',
  sizeBytes: null,
  sizeText: null,
  isRead: true,
  torrentUrl: 'https://example.com/kali.torrent',
  ...over,
});

describe('RssArticleDetails', () => {
  let fixture: ComponentFixture<RssArticleDetails>;
  let selected: ReturnType<typeof signal<RssArticle | null>>;
  let commandBus: { emit: ReturnType<typeof vi.fn> };
  let electron: { openExternalUrl: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    selected = signal<RssArticle | null>(article());
    commandBus = { emit: vi.fn() };
    electron = { openExternalUrl: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RssArticleDetails],
      providers: [
        { provide: RssStoreService, useValue: { selectedArticle: selected } },
        { provide: CommandBusService, useValue: commandBus },
        { provide: ElectronService, useValue: electron },
        { provide: DateFormatService, useValue: { format: (v: number) => `formatted:${v}` } },
        { provide: FilesizePipe, useValue: { transform: (v: number) => `${v} B` } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RssArticleDetails);
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const rerender = (value: RssArticle | null) => {
    selected.set(value);
    fixture.detectChanges();
  };

  it('asks for a selection when nothing is selected', () => {
    rerender(null);
    expect(el().textContent).toContain('pages.rss.details.empty');
    expect(el().querySelector('.rss-details__download')).toBeNull();
  });

  it('shows chip, title, formatted date, author, link and description', () => {
    expect(el().querySelector('.rss-details__chip')?.textContent?.trim()).toBe('Distribution');
    expect(el().querySelector('.rss-details__title')?.textContent?.trim()).toBe('Kali Linux');
    const text = el().textContent!;
    expect(text).toContain(`formatted:${new Date('2026-09-18T22:00:00Z').getTime()}`);
    expect(text).toContain('@FossTorrents');
    expect(text).toContain('https://example.com/kali');
    expect(text).toContain('Kali has been released.');
  });

  it('hides rows the feed did not provide', () => {
    rerender(article({ chip: null, date: null, author: null, link: null, description: '' }));

    expect(el().querySelector('.rss-details__chip')).toBeNull();
    expect(el().querySelector('.rss-details__row--size')).toBeNull();
    expect(el().querySelector('.rss-details__open')).toBeNull();
    expect(el().textContent).not.toContain('pages.rss.details.author');
    expect(el().textContent).not.toContain('pages.rss.details.date');
    expect(el().textContent).not.toContain('pages.rss.details.link');
  });

  it('formats a byte size and shows a textual size as-is', () => {
    rerender(article({ sizeBytes: 1024 }));
    expect(el().querySelector('.rss-details__row--size dd')?.textContent?.trim()).toBe('1024 B');

    rerender(article({ sizeBytes: null, sizeText: '1.2 GiB' }));
    expect(el().querySelector('.rss-details__row--size dd')?.textContent?.trim()).toBe('1.2 GiB');
  });

  it('enables Download and hands the url to the Add Torrent flow', () => {
    const button = el().querySelector('.rss-details__download') as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    button.click();

    expect(commandBus.emit).toHaveBeenCalledWith({
      type: 'UI_ADD_TORRENT',
      urls: ['https://example.com/kali.torrent'],
    });
  });

  it('disables Download for items without a torrent or magnet link', () => {
    rerender(article({ torrentUrl: null }));

    const button = el().querySelector('.rss-details__download') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    button.click();
    expect(commandBus.emit).not.toHaveBeenCalled();
  });

  it('opens the item link in the external browser', () => {
    (el().querySelector('.rss-details__open') as HTMLButtonElement).click();
    expect(electron.openExternalUrl).toHaveBeenCalledWith('https://example.com/kali');
  });
});
