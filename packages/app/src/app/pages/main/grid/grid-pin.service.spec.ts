import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CommandBusService } from '../../../services/command-bus.service';
import { GridStateService } from '../../../services/grid-state.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { GridPinService } from './grid-pin.service';

describe('GridPinService', () => {
  let service: GridPinService;
  const commands$ = new Subject<any>();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GridPinService,
        {
          provide: TorrentStoreService,
          useValue: { torrentsArray: signal([]) },
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
});
