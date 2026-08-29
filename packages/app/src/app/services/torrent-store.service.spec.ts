import { TestBed } from '@angular/core/testing';
import { Maindata, TorrentDelta } from '../models/torrent.model';
import { TorrentStoreService } from './torrent-store.service';

const makeMaindata = (opts: Partial<Maindata> & { full_update?: boolean }): Maindata =>
  ({
    rid: 1,
    full_update: false,
    torrents: {},
    torrents_removed: [],
    ...opts,
  }) as Maindata;

describe('TorrentStoreService', () => {
  let service: TorrentStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TorrentStoreService] });
    service = TestBed.inject(TorrentStoreService);
  });

  it('should start with an empty torrent map', () => {
    expect(service.torrentsMap().size).toBe(0);
  });

  it('should add torrents on full_update', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: {
          abc: { name: 'A', state: 'downloading' } as TorrentDelta,
          def: { name: 'B', state: 'uploading' } as TorrentDelta,
        },
      }),
    );

    expect(service.torrentsMap().size).toBe(2);
    expect(service.torrentsMap().get('abc')!.name).toBe('A');
  });

  it('should replace all torrents on a second full_update', () => {
    service.applyMaindata(
      makeMaindata({ full_update: true, torrents: { abc: { name: 'A' } as TorrentDelta } }),
    );
    service.applyMaindata(
      makeMaindata({ full_update: true, torrents: { xyz: { name: 'X' } as TorrentDelta } }),
    );

    expect(service.torrentsMap().size).toBe(1);
    expect(service.torrentsMap().has('xyz')).toBe(true);
    expect(service.torrentsMap().has('abc')).toBe(false);
  });

  it('should add new torrents on incremental update', () => {
    service.applyMaindata(
      makeMaindata({ full_update: true, torrents: { abc: { name: 'A' } as TorrentDelta } }),
    );
    service.applyMaindata(makeMaindata({ torrents: { def: { name: 'B' } as TorrentDelta } }));

    expect(service.torrentsMap().size).toBe(2);
  });

  it('should update existing torrents on incremental update', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: { abc: { name: 'Old', dlspeed: 0 } as TorrentDelta },
      }),
    );
    service.applyMaindata(makeMaindata({ torrents: { abc: { dlspeed: 1024 } as TorrentDelta } }));

    expect(service.torrentsMap().get('abc')!.dlspeed).toBe(1024);
    expect(service.torrentsMap().get('abc')!.name).toBe('Old');
  });

  it('should remove torrents from torrents_removed', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: {
          abc: { name: 'A' } as TorrentDelta,
          def: { name: 'B' } as TorrentDelta,
        },
      }),
    );
    service.applyMaindata(makeMaindata({ torrents_removed: ['abc'] }));

    expect(service.torrentsMap().size).toBe(1);
    expect(service.torrentsMap().has('abc')).toBe(false);
  });

  it('should compute torrentsArray from the map', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: {
          a: { name: 'A' } as TorrentDelta,
          b: { name: 'B' } as TorrentDelta,
        },
      }),
    );

    expect(service.torrentsArray()).toHaveLength(2);
  });

  it('should compute totalCount from the map', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: { a: { name: 'A' } as TorrentDelta },
      }),
    );

    expect(service.totalCount()).toBe(1);
  });

  it('should compute countsByState correctly', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: {
          a: { state: 'downloading' } as TorrentDelta,
          b: { state: 'downloading' } as TorrentDelta,
          c: { state: 'uploading' } as TorrentDelta,
        },
      }),
    );

    const counts = service.countsByState();
    expect(counts['downloading']).toBe(2);
    expect(counts['uploading']).toBe(1);
  });

  it('should update categories on full_update', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        categories: { Movies: { name: 'Movies', savePath: '/movies' } },
      }),
    );

    expect(service.categoriesMap().has('Movies')).toBe(true);
  });

  it('should update tags on full_update', () => {
    service.applyMaindata(makeMaindata({ full_update: true, tags: ['hd', '4k'] }));

    expect(service.tagsSet().has('hd')).toBe(true);
    expect(service.tagsSet().has('4k')).toBe(true);
  });

  it('should add tags incrementally', () => {
    service.applyMaindata(makeMaindata({ full_update: true, tags: ['hd'] }));
    service.applyMaindata(makeMaindata({ tags: ['4k'] }));

    expect(service.tagsSet().has('hd')).toBe(true);
    expect(service.tagsSet().has('4k')).toBe(true);
  });

  it('should remove tags from tags_removed', () => {
    service.applyMaindata(makeMaindata({ full_update: true, tags: ['hd', '4k'] }));
    service.applyMaindata(makeMaindata({ tags_removed: ['hd'] }));

    expect(service.tagsSet().has('hd')).toBe(false);
    expect(service.tagsSet().has('4k')).toBe(true);
  });

  it('should clear all state', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: { a: { name: 'A' } as TorrentDelta },
        tags: ['hd'],
        categories: { Movies: { name: 'Movies', savePath: '/movies' } },
      }),
    );

    service.clear();

    expect(service.torrentsMap().size).toBe(0);
    expect(service.tagsSet().size).toBe(0);
    expect(service.categoriesMap().size).toBe(0);
    expect(service.isPrimed()).toBe(false);
  });

  it('should set isPrimed to true after the first full_update', () => {
    expect(service.isPrimed()).toBe(false);
    service.applyMaindata(makeMaindata({ full_update: true }));
    expect(service.isPrimed()).toBe(true);
  });

  it('should emit finished$ when a torrent transitions to a seeding state after priming', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: {
          abc: { state: 'downloading', progress: 0.5, amount_left: 100 } as TorrentDelta,
        },
      }),
    );

    const finished: any[] = [];
    service.finished$.subscribe((e) => finished.push(e));

    service.applyMaindata(
      makeMaindata({
        torrents: { abc: { state: 'uploading', progress: 1.0, amount_left: 0 } as TorrentDelta },
      }),
    );

    expect(finished).toHaveLength(1);
    expect(finished[0].hash).toBe('abc');
  });

  it('should not emit finished$ for an already-finished torrent hash seen for the first time on a full_update after priming (e.g. a server switch)', () => {
    // Prime the store, e.g. with the previous server's data.
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: {
          abc: { state: 'downloading', progress: 0.5, amount_left: 100 } as TorrentDelta,
        },
      }),
    );

    const finished: any[] = [];
    service.finished$.subscribe((e) => finished.push(e));

    // A genuine server switch: a fresh full_update for a different server, containing a hash
    // never seen before that is already in a finished/seeding state.
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: {
          xyz: { state: 'uploading', progress: 1.0, amount_left: 0 } as TorrentDelta,
        },
      }),
    );

    expect(finished).toHaveLength(0);
  });

  it('should not change the torrentsMap/torrentsArray reference on an empty incremental delta', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: { abc: { name: 'A', state: 'downloading' } as TorrentDelta },
      }),
    );

    const mapBefore = service.torrentsMap();
    const arrayBefore = service.torrentsArray();

    service.applyMaindata(makeMaindata({}));

    expect(service.torrentsMap()).toBe(mapBefore);
    expect(service.torrentsArray()).toBe(arrayBefore);
  });

  it('should return delta from applyMaindata', () => {
    const delta = service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: { a: { name: 'A' } as TorrentDelta },
      }),
    );

    expect(delta.fullUpdate).toBe(true);
    expect(delta.add).toHaveLength(1);
    expect(delta.update).toHaveLength(0);
    expect(delta.remove).toHaveLength(0);
  });

  it('should emit delta$ with the same payload returned from applyMaindata on a full_update', () => {
    const emitted: any[] = [];
    service.delta$.subscribe((d) => emitted.push(d));

    const returned = service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: { a: { name: 'A' } as TorrentDelta },
      }),
    );

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(returned);
  });

  it('should emit delta$ with the same payload returned from applyMaindata on an incremental update', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: { abc: { name: 'A', dlspeed: 0 } as TorrentDelta },
      }),
    );

    const emitted: any[] = [];
    service.delta$.subscribe((d) => emitted.push(d));

    const returned = service.applyMaindata(
      makeMaindata({ torrents: { abc: { dlspeed: 1024 } as TorrentDelta } }),
    );

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(returned);
    expect(emitted[0].update).toHaveLength(1);
  });

  it('should emit a fullUpdate delta$ on clear()', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: { abc: { name: 'A' } as TorrentDelta },
      }),
    );

    const emitted: any[] = [];
    service.delta$.subscribe((d) => emitted.push(d));

    service.clear();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({ fullUpdate: true, add: [], update: [], remove: [] });
  });

  it('should still emit delta$ on a true no-op incremental update', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: { abc: { name: 'A' } as TorrentDelta },
      }),
    );

    const emitted: any[] = [];
    service.delta$.subscribe((d) => emitted.push(d));

    service.applyMaindata(makeMaindata({}));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({ fullUpdate: false, add: [], update: [], remove: [] });
  });

  describe('categoriesWithCounts', () => {
    it('includes known categories with zero torrents', () => {
      service.applyMaindata(
        makeMaindata({
          full_update: true,
          categories: { Movies: { name: 'Movies', savePath: '/movies' } },
        }),
      );

      const result = service.categoriesWithCounts();
      expect(result).toEqual([{ key: 'Movies', label: 'Movies', count: 0 }]);
    });

    it('counts torrents per category and sorts by label', () => {
      service.applyMaindata(
        makeMaindata({
          full_update: true,
          torrents: {
            a: { category: 'Movies' } as TorrentDelta,
            b: { category: 'Movies' } as TorrentDelta,
            c: { category: 'Books' } as TorrentDelta,
          },
        }),
      );

      expect(service.categoriesWithCounts()).toEqual([
        { key: 'Books', label: 'Books', count: 1 },
        { key: 'Movies', label: 'Movies', count: 2 },
      ]);
    });
  });

  describe('tagsWithCounts', () => {
    it('includes known tags with zero torrents', () => {
      service.applyMaindata(makeMaindata({ full_update: true, tags: ['hd'] }));

      expect(service.tagsWithCounts()).toEqual([{ key: 'hd', label: 'hd', count: 0 }]);
    });

    it('counts torrents per comma-separated tag and sorts by label', () => {
      service.applyMaindata(
        makeMaindata({
          full_update: true,
          torrents: {
            a: { tags: 'hd, 4k' } as TorrentDelta,
            b: { tags: 'hd' } as TorrentDelta,
          },
        }),
      );

      expect(service.tagsWithCounts()).toEqual([
        { key: '4k', label: '4k', count: 1 },
        { key: 'hd', label: 'hd', count: 2 },
      ]);
    });
  });

  describe('serverState', () => {
    it('should start as null', () => {
      expect(service.serverState()).toBeNull();
    });

    it('should be set on the first full_update', () => {
      service.applyMaindata(
        makeMaindata({
          full_update: true,
          server_state: { dl_info_speed: 100, up_info_speed: 50 } as any,
        }),
      );

      expect(service.serverState()?.dl_info_speed).toBe(100);
    });

    it('should merge partial server_state on incremental updates, keeping prior fields', () => {
      service.applyMaindata(
        makeMaindata({
          full_update: true,
          server_state: { dl_info_speed: 100, up_info_speed: 50 } as any,
        }),
      );
      service.applyMaindata(makeMaindata({ server_state: { dl_info_speed: 200 } as any }));

      expect(service.serverState()?.dl_info_speed).toBe(200);
      expect(service.serverState()?.up_info_speed).toBe(50);
    });

    it('should reset to null on clear()', () => {
      service.applyMaindata(
        makeMaindata({ full_update: true, server_state: { dl_info_speed: 100 } as any }),
      );
      service.clear();

      expect(service.serverState()).toBeNull();
    });
  });

  describe('statesWithCounts', () => {
    it('is empty with no torrents', () => {
      expect(service.statesWithCounts()).toEqual([]);
    });

    it('counts torrents per raw state and sorts alphabetically', () => {
      service.applyMaindata(
        makeMaindata({
          full_update: true,
          torrents: {
            a: { state: 'downloading' } as TorrentDelta,
            b: { state: 'downloading' } as TorrentDelta,
            c: { state: 'uploading' } as TorrentDelta,
          },
        }),
      );

      expect(service.statesWithCounts()).toEqual([
        { key: 'downloading', label: 'downloading', count: 2 },
        { key: 'uploading', label: 'uploading', count: 1 },
      ]);
    });
  });
});
