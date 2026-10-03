import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { DateFormatService } from '../../services/date-format.service';
import { ElectronService } from '../../services/electron.service';
import { QbService } from '../../services/qb.service';
import { RssStoreService } from '../../services/rss-store.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { Rss } from './rss';

const ITEMS = {
  Feed: {
    uid: '{1}',
    url: 'https://a/rss',
    articles: [
      {
        id: 'a1',
        title: 'Kali',
        date: '18 Sep 2026 22:00:00 +0000',
        link: 'https://x/a1',
        torrentURL: 'https://x/a1.torrent',
      },
    ],
  },
};

describe('Rss page', () => {
  let fixture: ComponentFixture<Rss>;
  let qb: any;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let commandBus: { emit: ReturnType<typeof vi.fn> };
  let serverId: ReturnType<typeof signal<string | null>>;

  const create = async () => {
    qb = {
      rss: {
        items: vi.fn().mockResolvedValue(ITEMS),
        refreshItem: vi.fn().mockResolvedValue(undefined),
        markAsRead: vi.fn().mockResolvedValue(undefined),
      },
      app: {
        preferences: vi.fn().mockResolvedValue({ rss_processing_enabled: true }),
        setPreferences: vi.fn().mockResolvedValue(undefined),
      },
    };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    commandBus = { emit: vi.fn() };
    serverId = signal<string | null>('s1');

    await TestBed.configureTestingModule({
      imports: [Rss],
      providers: [
        { provide: QbService, useValue: qb },
        { provide: Router, useValue: router },
        { provide: CommandBusService, useValue: commandBus },
        { provide: ServerStoreService, useValue: { currentServerId: serverId } },
        { provide: ToastService, useValue: { success: vi.fn(), danger: vi.fn() } },
        { provide: ConfirmService, useValue: { confirm: vi.fn() } },
        { provide: ElectronService, useValue: { openExternalUrl: vi.fn() } },
        { provide: DateFormatService, useValue: { format: (v: number) => String(v) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Rss);
    fixture.detectChanges();
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('loads feeds and preferences for the current server on init', async () => {
    await create();
    await vi.waitFor(() => expect(qb.rss.items).toHaveBeenCalledWith('s1'));
    expect(qb.app.preferences).toHaveBeenCalledWith('s1');
  });

  it('goes back to the torrent list', async () => {
    await create();
    (el().querySelector('.rss__back') as HTMLButtonElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/pages/torrent-list']);
  });

  it('renders the four header actions', async () => {
    await create();
    expect(el().querySelectorAll('.rss__actions .bb-tool')).toHaveLength(4);
  });

  it('opens the qB settings on the RSS tab from the settings button', async () => {
    await create();
    const settings = Array.from(el().querySelectorAll('.rss__actions .bb-tool')).at(
      -1,
    ) as HTMLElement;
    settings.click();
    expect(commandBus.emit).toHaveBeenCalledWith({
      type: 'UI_OPEN_QB_SETTINGS',
      tabToOpen: 'rss',
    });
  });

  it('asks for the add-subscription modal', async () => {
    await create();
    const actions = Array.from(el().querySelectorAll('.rss__actions .bb-tool')) as HTMLElement[];
    actions[2].click();
    expect(commandBus.emit).toHaveBeenCalledWith({ type: 'UI_RSS_ADD_SUBSCRIPTION' });
  });

  it('shows the enable banner only when RSS processing is off, and enables it', async () => {
    await create();
    await vi.waitFor(() => expect(qb.app.preferences).toHaveBeenCalled());
    fixture.detectChanges();
    expect(el().querySelector('.rss__banner')).toBeNull();

    TestBed.inject(RssStoreService).processingEnabled.set(false);
    fixture.detectChanges();
    const banner = el().querySelector('.rss__banner') as HTMLElement;
    expect(banner.textContent).toContain('pages.rss.banner.disabled');

    (banner.querySelector('button') as HTMLButtonElement).click();
    expect(qb.app.setPreferences).toHaveBeenCalledWith('s1', { rss_processing_enabled: true });
  });

  it('writes the filter box into the store and clears it', async () => {
    await create();
    const store = TestBed.inject(RssStoreService);
    const input = el().querySelector('.bb-search__input') as HTMLInputElement;

    input.value = 'kali';
    input.dispatchEvent(new Event('input'));
    expect(store.filterText()).toBe('kali');

    (el().querySelector('.bb-search__clear') as HTMLButtonElement).click();
    expect(store.filterText()).toBe('');
  });

  it('polls the feeds every 30 seconds', async () => {
    vi.useFakeTimers();
    await create();
    await vi.advanceTimersByTimeAsync(0);
    qb.rss.items.mockClear();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(qb.rss.items).toHaveBeenCalledTimes(1);
  });

  it('resets and reloads the store when the connected server changes', async () => {
    await create();
    const store = TestBed.inject(RssStoreService);
    await vi.waitFor(() => expect(store.feeds().length).toBe(1));

    qb.rss.items.mockClear();
    qb.app.preferences.mockClear();

    serverId.set('s2');
    fixture.detectChanges();

    expect(store.feeds()).toEqual([]);
    await vi.waitFor(() => expect(qb.rss.items).toHaveBeenCalledWith('s2'));
    expect(qb.app.preferences).toHaveBeenCalledWith('s2');
    await vi.waitFor(() => expect(store.feeds().length).toBe(1));
  });

  it('clears the store when the page is destroyed', async () => {
    await create();
    const store = TestBed.inject(RssStoreService);
    await vi.waitFor(() => expect(store.feeds().length).toBe(1));

    fixture.destroy();

    expect(store.feeds()).toEqual([]);
  });
});
