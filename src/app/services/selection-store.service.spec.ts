import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Torrent } from '../models/torrent.model';
import { SelectionStoreService } from './selection-store.service';
import { TorrentStoreService } from './torrent-store.service';

const torrents: Torrent[] = [
  { hash: '1', name: 'torrent 1' },
  { hash: '2', name: 'torrent 2' },
  { hash: '3', name: 'torrent 3' },
] as Torrent[];

describe('SelectionStoreService', () => {
  let service: SelectionStoreService;
  let torrentStore: Partial<TorrentStoreService>;

  beforeEach(() => {
    torrentStore = {
      torrentsMap: signal(new Map(torrents.map((t) => [t.hash, t]))),
    };

    TestBed.configureTestingModule({
      providers: [SelectionStoreService, { provide: TorrentStoreService, useValue: torrentStore }],
    });

    service = TestBed.inject(SelectionStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set selected torrents with an array', () => {
    service.set([torrents[0], torrents[1]]);
    expect(service.selected()).toEqual([torrents[0], torrents[1]]);
  });

  it('should set selected torrents with a single torrent', () => {
    service.set(torrents[0]);
    expect(service.selected()).toEqual([torrents[0]]);
  });

  it('should clear selected torrents', () => {
    service.set([torrents[0], torrents[1]]);
    service.clear();
    expect(service.selected()).toEqual([]);
  });

  it('should set selected torrents by hash', () => {
    service.setByHashes(['1', '3']);
    expect(service.selected()).toEqual([torrents[0], torrents[2]]);
  });

  it('should have the correct selected hashes', () => {
    service.set([torrents[0], torrents[2]]);
    expect(service.selectedHashes()).toEqual(['1', '3']);
  });
});
