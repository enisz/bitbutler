import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DEFAULT_SERVER_SETTINGS } from '../models/server-settings.model';
import { ServerSettingsService } from './server-settings.service';
import { ServerStoreService } from './server-store.service';
import { SettingsService } from './settings.service';

describe('ServerSettingsService', () => {
  let service: ServerSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        ServerSettingsService,
        { provide: SettingsService, useValue: mockSettingsService },
        {
          provide: ServerStoreService,
          useValue: { currentServerId: signal('server-1') },
        },
      ],
    });

    service = TestBed.inject(ServerSettingsService);
  });

  it('should return default settings when nothing is stored', async () => {
    const settings = await service.load();
    expect(settings).toEqual(DEFAULT_SERVER_SETTINGS);
  });

  it('should include server id in SETTINGS_ID', () => {
    expect((service as any).SETTINGS_ID).toContain('server-1');
  });

  it('should trim whitespace from remote and local path mappings', async () => {
    mockSettingsService.get.mockResolvedValue({
      ...DEFAULT_SERVER_SETTINGS,
      pathMappings: [{ remote: '  /remote  ', local: '  /local  ' }],
    });
    const settings = await service.load();
    expect(settings.pathMappings[0].remote).toBe('/remote');
    expect(settings.pathMappings[0].local).toBe('/local');
  });

  it('should filter out path mappings with empty remote after trim', async () => {
    mockSettingsService.get.mockResolvedValue({
      ...DEFAULT_SERVER_SETTINGS,
      pathMappings: [{ remote: '   ', local: '/local' }],
    });
    const settings = await service.load();
    expect(settings.pathMappings).toHaveLength(0);
  });

  it('should filter out path mappings with empty local after trim', async () => {
    mockSettingsService.get.mockResolvedValue({
      ...DEFAULT_SERVER_SETTINGS,
      pathMappings: [{ remote: '/remote', local: '   ' }],
    });
    const settings = await service.load();
    expect(settings.pathMappings).toHaveLength(0);
  });

  it('should keep valid path mappings', async () => {
    mockSettingsService.get.mockResolvedValue({
      ...DEFAULT_SERVER_SETTINGS,
      pathMappings: [
        { remote: '/remote', local: '/local' },
        { remote: '', local: '' },
      ],
    });
    const settings = await service.load();
    expect(settings.pathMappings).toHaveLength(1);
  });
});
