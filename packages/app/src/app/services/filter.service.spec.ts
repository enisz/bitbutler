import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Torrent } from '../models/torrent.model';
import { FilterService } from './filter.service';
import { TorrentStoreService } from './torrent-store.service';

describe('FilterService', () => {
  let service: FilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FilterService] });
    service = TestBed.inject(FilterService);
  });

  it('should initialise with empty external filter', () => {
    expect(service.external().search).toBe('');
    expect(service.external().states.size).toBe(0);
  });

  it('should update search', () => {
    service.setSearch('test');
    expect(service.external().search).toBe('test');
  });

  it('should update states', () => {
    service.setStates(['downloading', 'paused'] as any);
    expect(service.external().states.has('downloading' as any)).toBe(true);
  });

  it('should clear states', () => {
    service.setStates(['downloading'] as any);
    service.clearStates();
    expect(service.external().states.size).toBe(0);
  });

  it('should update column model', () => {
    service.setColumnModel({ name: { filterType: 'text' } });
    expect(service.columns()['name']).toBeDefined();
  });

  it('should reset all filters', () => {
    service.setSearch('test');
    service.setColumnModel({ name: { filterType: 'text' } });
    service.resetAll();
    expect(service.external().search).toBe('');
    expect(Object.keys(service.columns()).length).toBe(0);
  });

  it('should expose snapshot matching signal values', () => {
    service.setSearch('hello');
    expect(service.snapshot.external.search).toBe('hello');
  });

  it('should trim search input', () => {
    service.setSearch('  hello  ');
    expect(service.external().search).toBe('hello');
  });

  it('should clear search', () => {
    service.setSearch('hello');
    service.clearSearch();
    expect(service.external().search).toBe('');
  });

  it('should set and clear trackers', () => {
    service.setTrackers(['tracker1', 'tracker2']);
    expect(service.external().trackers.has('tracker1')).toBe(true);
    service.clearTrackers();
    expect(service.external().trackers.size).toBe(0);
  });

  it('should filter empty strings when setting trackers', () => {
    service.setTrackers(['tracker1', '  ', '']);
    expect(service.external().trackers.size).toBe(1);
  });

  it('should set and clear save paths', () => {
    service.setSavePaths(['/downloads', '/media']);
    expect(service.external().savePaths.has('/downloads')).toBe(true);
    service.clearSavePaths();
    expect(service.external().savePaths.size).toBe(0);
  });

  it('should set and clear categories', () => {
    service.setCategories(['movies', 'tv']);
    expect(service.external().categories.has('movies')).toBe(true);
    service.clearCategories();
    expect(service.external().categories.size).toBe(0);
  });

  it('should set and clear tags', () => {
    service.setTags(['hd', '4k']);
    expect(service.external().tags.has('hd')).toBe(true);
    service.clearTags();
    expect(service.external().tags.size).toBe(0);
  });

  it('should expose activeStates as a readonly set', () => {
    service.setStates(['downloading'] as any);
    expect(service.activeStates.has('downloading' as any)).toBe(true);
  });

  it('should set a single column filter', () => {
    service.setColumnFilter('name', { filterType: 'text', filter: 'ubuntu' });
    expect((service.columns() as any)['name']).toBeDefined();
  });

  it('should remove a column filter when value is null', () => {
    service.setColumnFilter('name', { filterType: 'text' });
    service.setColumnFilter('name', null);
    expect((service.columns() as any)['name']).toBeUndefined();
  });

  it('should ignore setColumnFilter with empty colId', () => {
    service.setColumnFilter('', { filterType: 'text' });
    expect(Object.keys(service.columns()).length).toBe(0);
  });

  it('should clear all column filters', () => {
    service.setColumnFilter('name', { filterType: 'text' });
    service.setColumnFilter('size', { filterType: 'number' });
    service.clearAllColumnFilters();
    expect(Object.keys(service.columns()).length).toBe(0);
  });

  it('should reset all filters including trackers, categories and tags', () => {
    service.setTrackers(['tracker1']);
    service.setCategories(['movies']);
    service.setTags(['hd']);
    service.resetAll();
    expect(service.external().trackers.size).toBe(0);
    expect(service.external().categories.size).toBe(0);
    expect(service.external().tags.size).toBe(0);
  });

  describe('filtered', () => {
    let filtered: FilterService;
    let torrentsArray: ReturnType<typeof signal<Torrent[]>>;

    const makeTorrent = (overrides: Partial<Torrent> & { hash: string }): Torrent =>
      ({
        name: overrides.hash,
        category: '',
        tags: '',
        save_path: '',
        state: 'downloading',
        tracker: '',
        ...overrides,
      }) as Torrent;

    beforeEach(() => {
      torrentsArray = signal<Torrent[]>([]);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [FilterService, { provide: TorrentStoreService, useValue: { torrentsArray } }],
      });
      filtered = TestBed.inject(FilterService);
    });

    it('should return all torrents unchanged when no filters are active', () => {
      const torrents = [makeTorrent({ hash: '1' }), makeTorrent({ hash: '2' })];
      torrentsArray.set(torrents);
      expect(filtered.filtered()).toEqual(torrents);
    });

    it('should OR within a group: torrents matching either of two selected categories', () => {
      const movie = makeTorrent({ hash: '1', category: 'Movies' });
      const tv = makeTorrent({ hash: '2', category: 'TV' });
      const music = makeTorrent({ hash: '3', category: 'Music' });
      torrentsArray.set([movie, tv, music]);

      filtered.setCategories(['Movies', 'TV']);

      expect(filtered.filtered()).toEqual([movie, tv]);
    });

    it('should AND across groups: only torrents matching both a category and a tag', () => {
      const movieHd = makeTorrent({ hash: '1', category: 'Movies', tags: 'hd' });
      const movie4k = makeTorrent({ hash: '2', category: 'Movies', tags: '4k' });
      const tvHd = makeTorrent({ hash: '3', category: 'TV', tags: 'hd' });
      torrentsArray.set([movieHd, movie4k, tvHd]);

      filtered.setCategories(['Movies']);
      filtered.setTags(['hd']);

      expect(filtered.filtered()).toEqual([movieHd]);
    });

    it('should OR within a group: torrents in any of several selected states', () => {
      const downloading = makeTorrent({ hash: '1', state: 'downloading' });
      const uploading = makeTorrent({ hash: '2', state: 'uploading' });
      const paused = makeTorrent({ hash: '3', state: 'pausedDL' });
      torrentsArray.set([downloading, uploading, paused]);

      filtered.setStates(['downloading', 'uploading']);

      expect(filtered.filtered()).toEqual([downloading, uploading]);
    });
  });
});
