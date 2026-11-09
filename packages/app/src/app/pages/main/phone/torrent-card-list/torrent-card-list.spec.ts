import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import {
  DEFAULT_MOBILE_LIST_SETTINGS,
  MobileListSettings,
} from '../../../../models/mobile-list-settings.model';
import { Torrent } from '../../../../models/torrent.model';
import { CommandBusService } from '../../../../services/command-bus.service';
import { FilterService } from '../../../../services/filter.service';
import { MobileListSettingsService } from '../../../../services/mobile-list-settings.service';
import { SelectionStoreService } from '../../../../services/selection-store.service';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import {
  CARD_ITEM_SIZE,
  ROW_ITEM_SIZE,
  TorrentCardList,
  etaLabel,
  stateKind,
} from './torrent-card-list';

function makeTorrent(hash: string, patch: Partial<Torrent> = {}): Torrent {
  return {
    hash,
    name: `torrent ${hash}`,
    state: 'downloading',
    category: '',
    tags: '',
    tracker: '',
    save_path: '/dl',
    added_on: Number(hash.replace(/\D/g, '')) || 0,
    progress: 0.5,
    dlspeed: 0,
    upspeed: 0,
    size: 1000,
    ratio: 0,
    eta: 100,
    ...patch,
  } as Torrent;
}

describe('TorrentCardList', () => {
  let settings$: BehaviorSubject<MobileListSettings>;
  let store: TorrentStoreService;
  let selection: SelectionStoreService;
  let commandBus: CommandBusService;
  let filter: FilterService;

  const load = (torrents: Torrent[]) =>
    store.applyMaindata({
      full_update: true,
      torrents: Object.fromEntries(torrents.map((t) => [t.hash, t])),
    } as never);

  const create = () => {
    const fixture = TestBed.createComponent(TorrentCardList);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    settings$ = new BehaviorSubject(DEFAULT_MOBILE_LIST_SETTINGS);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: MobileListSettingsService,
          useValue: {
            asObservable: () => settings$.asObservable(),
            load: () => Promise.resolve(settings$.value),
            save: (s: MobileListSettings) => {
              settings$.next(s);
              return Promise.resolve();
            },
          },
        },
      ],
    });
    store = TestBed.inject(TorrentStoreService);
    selection = TestBed.inject(SelectionStoreService);
    commandBus = TestBed.inject(CommandBusService);
    filter = TestBed.inject(FilterService);
  });

  it('opens the details when a card is tapped and nothing is selected', () => {
    load([makeTorrent('a1')]);
    const emit = vi.spyOn(commandBus, 'emit');
    const fixture = create();

    fixture.componentInstance.onTap(store.torrentsMap().get('a1') as Torrent);

    expect(emit).toHaveBeenCalledWith({ type: 'UI_OPEN_TORRENT_DETAILS', hash: 'a1' });
  });

  it('selects exactly the pressed torrent on long press and enters selection mode', () => {
    load([makeTorrent('a1'), makeTorrent('a2')]);
    const fixture = create();
    expect(fixture.componentInstance.selectionMode()).toBe(false);

    fixture.componentInstance.onLongPress(store.torrentsMap().get('a2') as Torrent);

    expect(selection.selectedHashes()).toEqual(['a2']);
    expect(fixture.componentInstance.selectionMode()).toBe(true);
  });

  it('toggles a torrent instead of opening details while in selection mode', () => {
    load([makeTorrent('a1'), makeTorrent('a2')]);
    const emit = vi.spyOn(commandBus, 'emit');
    const fixture = create();
    const [a1, a2] = [store.torrentsMap().get('a1'), store.torrentsMap().get('a2')] as Torrent[];

    fixture.componentInstance.onLongPress(a1);
    fixture.componentInstance.onTap(a2);
    expect(selection.selectedHashes().sort()).toEqual(['a1', 'a2']);

    fixture.componentInstance.onTap(a2);
    expect(selection.selectedHashes()).toEqual(['a1']);
    expect(emit).not.toHaveBeenCalled();
  });

  it('leaves selection mode when the last selected torrent is toggled off', () => {
    load([makeTorrent('a1')]);
    const fixture = create();
    const a1 = store.torrentsMap().get('a1') as Torrent;

    fixture.componentInstance.onLongPress(a1);
    fixture.componentInstance.onTap(a1);

    expect(fixture.componentInstance.selectionMode()).toBe(false);
  });

  it('drops a selected torrent that a poll removes and leaves selection mode when none remain', () => {
    load([makeTorrent('a1'), makeTorrent('a2')]);
    const fixture = create();
    const [a1, a2] = [store.torrentsMap().get('a1'), store.torrentsMap().get('a2')] as Torrent[];
    fixture.componentInstance.onLongPress(a1);
    fixture.componentInstance.onTap(a2);

    store.applyMaindata({ torrents_removed: ['a1'] } as never);
    TestBed.tick();
    expect(selection.selectedHashes()).toEqual(['a2']);
    expect(fixture.componentInstance.selectionMode()).toBe(true);

    store.applyMaindata({ torrents_removed: ['a2'] } as never);
    TestBed.tick();
    expect(selection.selectedHashes()).toEqual([]);
    expect(fixture.componentInstance.selectionMode()).toBe(false);
  });

  it('uses the card height normally and the row height in compact mode', () => {
    const fixture = create();
    expect(fixture.componentInstance.itemSize()).toBe(CARD_ITEM_SIZE);

    settings$.next({ ...DEFAULT_MOBILE_LIST_SETTINGS, compactRows: true });
    TestBed.tick();
    expect(fixture.componentInstance.itemSize()).toBe(ROW_ITEM_SIZE);
  });

  it('shows a loading message until the store is primed', () => {
    const fixture = create();
    expect(fixture.nativeElement.querySelector('[data-testid="list-loading"]')).not.toBeNull();
  });

  it('shows the empty message when the library has no torrents', () => {
    load([]);
    const fixture = create();
    expect(fixture.nativeElement.querySelector('[data-testid="list-empty"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="list-no-matches"]')).toBeNull();
  });

  it('shows the no-matches message when a search hides every torrent', () => {
    load([makeTorrent('a1', { name: 'ubuntu' })]);
    filter.setSearch('zzz');
    const fixture = create();
    expect(fixture.nativeElement.querySelector('[data-testid="list-no-matches"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="list-empty"]')).toBeNull();
  });

  describe('etaLabel', () => {
    it('shows an infinity symbol for the unknown ETA value 8640000', () => {
      expect(etaLabel(makeTorrent('a1', { eta: 8640000 }))).toBe('∞');
    });

    it('returns an empty string when the torrent is not downloading with a known ETA', () => {
      expect(etaLabel(makeTorrent('a1', { eta: 0 }))).toBe('');
    });

    it('formats a known ETA in seconds', () => {
      expect(etaLabel(makeTorrent('a1', { eta: 90 }))).not.toBe('');
      expect(etaLabel(makeTorrent('a1', { eta: 90 }))).not.toBe('∞');
    });
  });

  describe('stateKind', () => {
    it('groups qBittorrent states into a short label kind', () => {
      expect(stateKind('downloading')).toBe('downloading');
      expect(stateKind('forcedDL')).toBe('downloading');
      expect(stateKind('uploading')).toBe('seeding');
      expect(stateKind('stalledUP')).toBe('seeding');
      expect(stateKind('pausedDL')).toBe('paused');
      expect(stateKind('stoppedUP')).toBe('paused');
      expect(stateKind('stalledDL')).toBe('stalled');
      expect(stateKind('queuedDL')).toBe('queued');
      expect(stateKind('checkingUP')).toBe('checking');
      expect(stateKind('error')).toBe('error');
      expect(stateKind('missingFiles')).toBe('error');
      expect(stateKind('metaDL')).toBe('other');
    });
  });
});
