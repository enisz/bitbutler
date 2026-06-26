import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { DEFAULT_TORRENT_LIST_GRID_SETTINGS } from '../models/torrent-list-grid.model';
import { SettingsService } from './settings.service';
import { TorrentListGridSettingsService } from './torrent-list-grid.settings.service';
import { UiFormatService } from './ui-format.service';

describe('TorrentListGridSettingsService', () => {
  let service: TorrentListGridSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        TorrentListGridSettingsService,
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: UiFormatService, useValue: {} },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });

    service = TestBed.inject(TorrentListGridSettingsService);
  });

  it('should return settings with expected shape when nothing is stored', async () => {
    const settings = await service.load();
    expect(settings).toBeDefined();
    expect(typeof settings.pagination).toBe('boolean');
    expect(typeof settings.animateRows).toBe('boolean');
    expect(settings.rowDoubleClickAction).toBe('DETAILS');
  });

  it('should pass through ColumnState[] objects unchanged', async () => {
    const columnState = [
      { colId: 'name', hide: false, width: 200 },
      { colId: 'size', hide: true },
    ];
    mockSettingsService.get.mockResolvedValue({
      ...DEFAULT_TORRENT_LIST_GRID_SETTINGS,
      columnState,
    });
    const settings = await service.load();
    expect(settings.columnState).toEqual(columnState);
  });

  it('should detect string[] columnState (legacy format)', async () => {
    mockSettingsService.get.mockResolvedValue({
      ...DEFAULT_TORRENT_LIST_GRID_SETTINGS,
      columnState: ['name', 'size'],
    });
    const settings = await service.load();
    expect(Array.isArray(settings.columnState)).toBe(true);
    if (Array.isArray(settings.columnState) && settings.columnState.length > 0) {
      expect(typeof (settings.columnState[0] as any).colId).toBe('string');
    }
  });

  it('should keep null columnState as null', async () => {
    mockSettingsService.get.mockResolvedValue({
      ...DEFAULT_TORRENT_LIST_GRID_SETTINGS,
      columnState: null,
    });
    const settings = await service.load();
    expect(settings.columnState).toBeNull();
  });

  it('should default pausePollingOnModal to false when nothing is stored', async () => {
    const settings = await service.load();
    expect(settings.pausePollingOnModal).toBe(false);
  });
});
