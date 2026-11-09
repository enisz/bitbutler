import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import {
  DEFAULT_MOBILE_LIST_SETTINGS,
  MobileListSettings,
} from '../../../models/mobile-list-settings.model';
import { Torrent } from '../../../models/torrent.model';
import { FilterService } from '../../../services/filter.service';
import { MobileListSettingsService } from '../../../services/mobile-list-settings.service';
import { TorrentListGridSettingsService } from '../../../services/torrent-list-grid.settings.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { PhoneListStateService } from './phone-list-state.service';

function makeTorrent(hash: string, patch: Partial<Torrent> = {}): Torrent {
  return {
    hash,
    name: `torrent ${hash}`,
    state: 'downloading',
    category: '',
    tags: '',
    tracker: '',
    save_path: '/dl',
    added_on: 0,
    progress: 0,
    dlspeed: 0,
    upspeed: 0,
    size: 0,
    ratio: 0,
    eta: 0,
    ...patch,
  } as Torrent;
}

describe('PhoneListStateService', () => {
  let service: PhoneListStateService;
  let store: TorrentStoreService;
  let filter: FilterService;
  let settings$: BehaviorSubject<MobileListSettings>;
  let savedSettings: MobileListSettings[];
  let gridSave: ReturnType<typeof vi.fn>;

  const load = (torrents: Torrent[]) =>
    store.applyMaindata({
      full_update: true,
      torrents: Object.fromEntries(torrents.map((t) => [t.hash, t])),
    } as never);

  beforeEach(() => {
    settings$ = new BehaviorSubject<MobileListSettings>(DEFAULT_MOBILE_LIST_SETTINGS);
    savedSettings = [];
    gridSave = vi.fn(() => Promise.resolve());
    TestBed.configureTestingModule({
      providers: [
        {
          provide: MobileListSettingsService,
          useValue: {
            asObservable: () => settings$.asObservable(),
            load: () => Promise.resolve(settings$.value),
            save: (s: MobileListSettings) => {
              savedSettings.push(s);
              settings$.next(s);
              return Promise.resolve();
            },
          },
        },
        {
          provide: TorrentListGridSettingsService,
          useValue: { save: gridSave },
        },
      ],
    });
    store = TestBed.inject(TorrentStoreService);
    filter = TestBed.inject(FilterService);
    service = TestBed.inject(PhoneListStateService);
  });

  it('defaults to newest first by added_on', () => {
    load([
      makeTorrent('a', { added_on: 1 }),
      makeTorrent('b', { added_on: 3 }),
      makeTorrent('c', { added_on: 2 }),
    ]);
    expect(service.sortKey()).toBe('added_on');
    expect(service.sortDesc()).toBe(true);
    expect(service.items().map((t) => t.hash)).toEqual(['b', 'c', 'a']);
  });

  const seed = (patch: Partial<MobileListSettings>) =>
    settings$.next({ ...DEFAULT_MOBILE_LIST_SETTINGS, ...patch });

  it('sorts numeric keys ascending and descending', () => {
    load([
      makeTorrent('a', { size: 20 }),
      makeTorrent('b', { size: 30 }),
      makeTorrent('c', { size: 10 }),
    ]);
    seed({ sortKey: 'size', sortDesc: false });
    expect(service.items().map((t) => t.hash)).toEqual(['c', 'a', 'b']);
    seed({ sortKey: 'size', sortDesc: true });
    expect(service.items().map((t) => t.hash)).toEqual(['b', 'a', 'c']);
  });

  it('sorts names case-insensitively', () => {
    load([
      makeTorrent('1', { name: 'banana' }),
      makeTorrent('2', { name: 'Apple' }),
      makeTorrent('3', { name: 'cherry' }),
    ]);
    seed({ sortKey: 'name', sortDesc: false });
    expect(service.items().map((t) => t.name)).toEqual(['Apple', 'banana', 'cherry']);
  });

  it('items sorts by last_activity descending', () => {
    load([
      makeTorrent('a', { last_activity: 10 }),
      makeTorrent('b', { last_activity: 30 }),
      makeTorrent('c', { last_activity: 20 }),
    ]);
    seed({ sortKey: 'last_activity', sortDesc: true });
    expect(service.items().map((t) => t.hash)).toEqual(['b', 'c', 'a']);
  });

  it('breaks ties on hash so equal keys keep a stable order', () => {
    load([
      makeTorrent('c', { dlspeed: 5 }),
      makeTorrent('a', { dlspeed: 5 }),
      makeTorrent('b', { dlspeed: 5 }),
    ]);
    seed({ sortKey: 'dlspeed', sortDesc: false });
    expect(service.items().map((t) => t.hash)).toEqual(['a', 'b', 'c']);
    load([
      makeTorrent('b', { dlspeed: 5 }),
      makeTorrent('c', { dlspeed: 5 }),
      makeTorrent('a', { dlspeed: 5 }),
    ]);
    expect(service.items().map((t) => t.hash)).toEqual(['a', 'b', 'c']);
  });

  it('setSort on the active key flips the direction', async () => {
    await service.setSort('added_on');
    expect(service.sortDesc()).toBe(false);
    await service.setSort('added_on');
    expect(service.sortDesc()).toBe(true);
  });

  it('two rapid setSort taps on the active key flip the direction twice', async () => {
    const mock = TestBed.inject(MobileListSettingsService) as unknown as {
      save: (s: MobileListSettings) => Promise<void>;
    };
    const fastSave = mock.save;
    mock.save = (s) => new Promise<void>((resolve) => setTimeout(() => resolve(fastSave(s)), 0));
    const original = service.sortDesc();
    await Promise.all([service.setSort('added_on'), service.setSort('added_on')]);
    expect(service.sortDesc()).toBe(original);
  });

  it('setSort to name starts ascending', async () => {
    await service.setSort('name');
    expect(service.sortKey()).toBe('name');
    expect(service.sortDesc()).toBe(false);
  });

  it.each(['size', 'progress', 'dlspeed', 'upspeed', 'ratio', 'last_activity'] as const)(
    'setSort to %s starts descending',
    async (key) => {
      seed({ sortKey: 'name', sortDesc: false });
      await service.setSort(key);
      expect(service.sortKey()).toBe(key);
      expect(service.sortDesc()).toBe(true);
    },
  );

  it('setSort to added_on from another key starts descending', async () => {
    seed({ sortKey: 'name', sortDesc: false });
    await service.setSort('added_on');
    expect(service.sortKey()).toBe('added_on');
    expect(service.sortDesc()).toBe(true);
  });

  it('follows the shared filter', () => {
    load([makeTorrent('a', { name: 'ubuntu' }), makeTorrent('b', { name: 'debian' })]);
    filter.setSearch('ubu');
    expect(service.items().map((t) => t.hash)).toEqual(['a']);
  });

  it('setCompact persists via MobileListSettingsService and never saves grid settings', async () => {
    expect(service.compact()).toBe(false);
    await service.setCompact(true);
    expect(savedSettings).toHaveLength(1);
    expect(savedSettings[0].compactRows).toBe(true);
    expect(service.compact()).toBe(true);
    expect(gridSave).not.toHaveBeenCalled();
  });

  it('sorts and filters 12000 torrents within budget', () => {
    const many: Torrent[] = [];
    for (let i = 0; i < 12000; i++) {
      many.push(
        makeTorrent(`h${i.toString().padStart(5, '0')}`, {
          name: `Torrent number ${(i * 7919) % 12000} sample`,
          added_on: (i * 31) % 5000,
          size: (i * 104729) % 100000,
        }),
      );
    }
    load(many);
    filter.setSearch('number 1');

    const start = performance.now();
    const result = service.items();
    const elapsed = performance.now() - start;
    console.log(`phone list: sort+filter 12000 torrents took ${elapsed.toFixed(1)} ms`);

    expect(result.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(250);
  });
});
