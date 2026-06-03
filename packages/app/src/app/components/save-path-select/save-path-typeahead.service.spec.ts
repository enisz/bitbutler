import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { Torrent } from '../../models/torrent.model';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { SavePathTypeaheadService } from './save-path-typeahead.service';

const makeTorrents = (savePaths: string[]): Torrent[] =>
  savePaths.map((p, i) => ({ hash: String(i), save_path: p }) as Torrent);

describe('SavePathTypeaheadService', () => {
  let service: SavePathTypeaheadService;
  let torrentsSignal: ReturnType<typeof signal<Torrent[]>>;

  beforeEach(() => {
    torrentsSignal = signal<Torrent[]>([]);

    TestBed.configureTestingModule({
      providers: [
        SavePathTypeaheadService,
        {
          provide: TorrentStoreService,
          useValue: { torrentsArray: torrentsSignal },
        },
      ],
    });

    service = TestBed.inject(SavePathTypeaheadService);
  });

  it('should return an empty array for empty search term', async () => {
    torrentsSignal.set(makeTorrents(['/downloads', '/media']));
    const results = await firstValueFrom(service.searchSavePaths(of('')));
    expect(results).toEqual([]);
  });

  it('should filter save paths by search term', async () => {
    torrentsSignal.set(makeTorrents(['/downloads/movies', '/downloads/music', '/media']));
    const results = await firstValueFrom(service.searchSavePaths(of('downloads')));
    expect(results).toHaveLength(2);
    expect(results.every((p) => p.includes('downloads'))).toBe(true);
  });

  it('should be case-insensitive', async () => {
    torrentsSignal.set(makeTorrents(['/Downloads/Movies']));
    const results = await firstValueFrom(service.searchSavePaths(of('downloads')));
    expect(results).toHaveLength(1);
  });

  it('should limit results to 5 entries', async () => {
    torrentsSignal.set(makeTorrents(['/a/1', '/a/2', '/a/3', '/a/4', '/a/5', '/a/6', '/a/7']));
    const results = await firstValueFrom(service.searchSavePaths(of('/a/')));
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('should exclude paths that exactly match the search term', async () => {
    torrentsSignal.set(makeTorrents(['/downloads', '/downloads/movies']));
    const results = await firstValueFrom(service.searchSavePaths(of('/downloads')));
    expect(results).not.toContain('/downloads');
  });

  it('should deduplicate save paths from multiple torrents', async () => {
    torrentsSignal.set(makeTorrents(['/downloads', '/downloads', '/downloads/movies']));
    const results = await firstValueFrom(service.searchSavePaths(of('down')));
    const unique = new Set(results);
    expect(unique.size).toBe(results.length);
  });
});
