import { TestBed } from '@angular/core/testing';
import { DEFAULT_MOBILE_LIST_SETTINGS } from '../models/mobile-list-settings.model';
import { DEFAULT_TORRENT_LIST_GRID_SETTINGS } from '../models/torrent-list-grid.model';
import { MobileListSettingsService } from './mobile-list-settings.service';
import { SettingsService } from './settings.service';

describe('MobileListSettingsService', () => {
  let service: MobileListSettingsService;
  let stored: Record<string, unknown>;

  beforeEach(() => {
    stored = {};
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SettingsService,
          useValue: {
            get: vi.fn((id: string) => Promise.resolve(stored[id] ?? null)),
            set: vi.fn((id: string, v: unknown) => {
              stored[id] = v;
              return Promise.resolve();
            }),
          },
        },
      ],
    });
    service = TestBed.inject(MobileListSettingsService);
  });

  it('defaults are compact false, added_on, descending', async () => {
    const settings = await service.load();
    expect(settings).toEqual({ compactRows: false, sortKey: 'added_on', sortDesc: true });
    expect(settings).toEqual(DEFAULT_MOBILE_LIST_SETTINGS);
  });

  it('an unknown stored sortKey falls back to the default', async () => {
    stored['MobileListSettingsService'] = { compactRows: true, sortKey: 'eta', sortDesc: false };
    const settings = await service.load();
    expect(settings.sortKey).toBe('added_on');
    expect(settings.sortDesc).toBe(true);
    expect(settings.compactRows).toBe(true);
  });

  it('compact is independent of TorrentListGridSettings', async () => {
    stored['TorrentListGridSettingsService'] = {
      ...DEFAULT_TORRENT_LIST_GRID_SETTINGS,
      compactRows: true,
    };
    const settings = await service.load();
    expect(settings.compactRows).toBe(false);
  });
});
