import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DEFAULT_ADD_TORRENT_SETTINGS } from '../models/add-torrent.model';
import { AddTorrentSettingsService } from './add-torrent-settings.service';
import { ServerStoreService } from './server-store.service';
import { SettingsService } from './settings.service';

describe('AddTorrentSettingsService', () => {
  let service: AddTorrentSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        AddTorrentSettingsService,
        { provide: SettingsService, useValue: mockSettingsService },
        {
          provide: ServerStoreService,
          useValue: { currentServerId: signal('server-1') },
        },
      ],
    });

    service = TestBed.inject(AddTorrentSettingsService);
  });

  it('should return default settings when nothing is stored', async () => {
    const settings = await service.load();
    expect(settings).toMatchObject(DEFAULT_ADD_TORRENT_SETTINGS);
  });

  it('should trim whitespace from savepath during normalize', async () => {
    mockSettingsService.get.mockResolvedValue({
      ...DEFAULT_ADD_TORRENT_SETTINGS,
      savepath: '  /path/to/dir  ',
    });
    const settings = await service.load();
    expect(settings.savepath).toBe('/path/to/dir');
  });

  it('should set savepath to null when empty after trim', async () => {
    mockSettingsService.get.mockResolvedValue({ ...DEFAULT_ADD_TORRENT_SETTINGS, savepath: '   ' });
    const settings = await service.load();
    expect(settings.savepath).toBeNull();
  });

  it('should trim whitespace from category during normalize', async () => {
    mockSettingsService.get.mockResolvedValue({
      ...DEFAULT_ADD_TORRENT_SETTINGS,
      category: '  Movies  ',
    });
    const settings = await service.load();
    expect(settings.category).toBe('Movies');
  });

  it('should set category to null when empty after trim', async () => {
    mockSettingsService.get.mockResolvedValue({ ...DEFAULT_ADD_TORRENT_SETTINGS, category: '' });
    const settings = await service.load();
    expect(settings.category).toBeNull();
  });

  it('should trim whitespace from tags during normalize', async () => {
    mockSettingsService.get.mockResolvedValue({
      ...DEFAULT_ADD_TORRENT_SETTINGS,
      tags: '  hd, 4k  ',
    });
    const settings = await service.load();
    expect(settings.tags).toBe('hd, 4k');
  });

  it('should set null tags to null', async () => {
    mockSettingsService.get.mockResolvedValue({ ...DEFAULT_ADD_TORRENT_SETTINGS, tags: null });
    const settings = await service.load();
    expect(settings.tags).toBeNull();
  });

  it('should include server id in SETTINGS_ID', () => {
    expect((service as any).SETTINGS_ID).toContain('server-1');
  });
});
