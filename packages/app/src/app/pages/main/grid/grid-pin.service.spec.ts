import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CommandBusService } from '../../../services/command-bus.service';
import { GridStateService } from '../../../services/grid-state.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { GridPinService } from './grid-pin.service';

const makeTorrent = (hash: string, overrides: Record<string, unknown> = {}) =>
  ({ hash, name: hash, ...overrides }) as any;

describe('GridPinService', () => {
  let service: GridPinService;
  let api: { setGridOption: ReturnType<typeof vi.fn>; applyTransaction: ReturnType<typeof vi.fn> };
  const commands$ = new Subject<any>();
  const delta$ = new Subject<any>();
  const torrentsArray = signal<any[]>([]);

  beforeEach(() => {
    api = { setGridOption: vi.fn(), applyTransaction: vi.fn() };
    torrentsArray.set([]);

    TestBed.configureTestingModule({
      providers: [
        GridPinService,
        {
          provide: TorrentStoreService,
          useValue: { torrentsArray, delta$: delta$.asObservable() },
        },
        {
          provide: SelectionStoreService,
          useValue: { selected: signal([]) },
        },
        {
          provide: GridStateService,
          useValue: { save: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: CommandBusService,
          useValue: { emit: vi.fn(), commands$: commands$.asObservable() },
        },
      ],
    });

    service = TestBed.inject(GridPinService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('applyPinnedState / getPinnedTopHashes / getPinnedBottomHashes', () => {
    it('should start with empty pin lists', () => {
      expect(service.getPinnedTopHashes()).toEqual([]);
      expect(service.getPinnedBottomHashes()).toEqual([]);
    });

    it('should apply top and bottom pinned hashes', () => {
      service.applyPinnedState(['hash1', 'hash2'], ['hash3']);
      expect(service.getPinnedTopHashes()).toEqual(['hash1', 'hash2']);
      expect(service.getPinnedBottomHashes()).toEqual(['hash3']);
    });

    it('should replace previously pinned hashes on subsequent apply', () => {
      service.applyPinnedState(['hash1'], ['hash2']);
      service.applyPinnedState(['hash3', 'hash4'], []);
      expect(service.getPinnedTopHashes()).toEqual(['hash3', 'hash4']);
      expect(service.getPinnedBottomHashes()).toEqual([]);
    });

    it('should handle empty arrays', () => {
      service.applyPinnedState([], []);
      expect(service.getPinnedTopHashes()).toEqual([]);
      expect(service.getPinnedBottomHashes()).toEqual([]);
    });

    it('should return new arrays on each call to getPinnedTopHashes', () => {
      service.applyPinnedState(['hash1'], []);
      const first = service.getPinnedTopHashes();
      const second = service.getPinnedTopHashes();
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });
  });

  describe('grid sync', () => {
    it('should seed rowData from the current torrent list once the grid api is ready', () => {
      torrentsArray.set([makeTorrent('a'), makeTorrent('b')]);

      service.init(api as any);
      TestBed.tick();

      expect(api.setGridOption).toHaveBeenCalledWith('rowData', [
        makeTorrent('a'),
        makeTorrent('b'),
      ]);
      expect(api.setGridOption).toHaveBeenCalledWith('pinnedTopRowData', []);
      expect(api.setGridOption).toHaveBeenCalledWith('pinnedBottomRowData', []);
    });

    it('should not touch the grid when the torrent list changes without a delta', () => {
      service.init(api as any);
      TestBed.tick();
      api.setGridOption.mockClear();

      torrentsArray.set([makeTorrent('z')]);
      TestBed.tick();

      expect(api.setGridOption).not.toHaveBeenCalled();
    });

    it('should apply an incremental delta as a grid transaction instead of resetting rowData', () => {
      service.init(api as any);
      TestBed.tick();
      api.setGridOption.mockClear();

      delta$.next({ fullUpdate: false, add: [makeTorrent('c')], update: [], remove: [] });

      expect(api.applyTransaction).toHaveBeenCalledWith({
        add: [makeTorrent('c')],
        update: [],
        remove: [],
      });
      expect(api.setGridOption).not.toHaveBeenCalledWith('rowData', expect.anything());
    });

    it('should route updates to a pinned-top torrent into pinnedTopRowData instead of the main transaction', () => {
      service.applyPinnedState(['p'], []);
      service.init(api as any);
      TestBed.tick();
      api.setGridOption.mockClear();
      api.applyTransaction.mockClear();

      delta$.next({
        fullUpdate: false,
        add: [],
        update: [makeTorrent('p', { dlspeed: 5 })],
        remove: [],
      });

      expect(api.applyTransaction).not.toHaveBeenCalled();
      expect(api.setGridOption).toHaveBeenCalledWith('pinnedTopRowData', [
        makeTorrent('p', { dlspeed: 5 }),
      ]);
    });

    it('should remove a pinned-bottom torrent from pinnedBottomRowData when it disappears', () => {
      torrentsArray.set([makeTorrent('q')]);
      service.applyPinnedState([], ['q']);
      service.init(api as any);
      TestBed.tick();
      api.setGridOption.mockClear();

      delta$.next({ fullUpdate: false, add: [], update: [], remove: [makeTorrent('q')] });

      expect(api.applyTransaction).not.toHaveBeenCalled();
      expect(api.setGridOption).toHaveBeenCalledWith('pinnedBottomRowData', []);
    });

    it('should do nothing when a delta has no adds, updates, or removes', () => {
      service.init(api as any);
      TestBed.tick();
      api.setGridOption.mockClear();
      api.applyTransaction.mockClear();

      delta$.next({ fullUpdate: false, add: [], update: [], remove: [] });

      expect(api.applyTransaction).not.toHaveBeenCalled();
      expect(api.setGridOption).not.toHaveBeenCalled();
    });

    it('should do a full resync from the current torrent list on a fullUpdate delta', () => {
      service.init(api as any);
      TestBed.tick();
      torrentsArray.set([makeTorrent('x')]);
      api.setGridOption.mockClear();

      delta$.next({ fullUpdate: true, add: [makeTorrent('x')], update: [], remove: [] });

      expect(api.setGridOption).toHaveBeenCalledWith('rowData', [makeTorrent('x')]);
    });

    it('should do a full resync when pinned hashes change', () => {
      torrentsArray.set([makeTorrent('a'), makeTorrent('b')]);
      service.init(api as any);
      TestBed.tick();
      api.setGridOption.mockClear();

      service.applyPinnedState(['a'], []);
      TestBed.tick();

      expect(api.setGridOption).toHaveBeenCalledWith('rowData', [makeTorrent('b')]);
      expect(api.setGridOption).toHaveBeenCalledWith('pinnedTopRowData', [makeTorrent('a')]);
    });
  });
});
