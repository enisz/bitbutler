import { TestBed } from '@angular/core/testing';
import { DEFAULT_TRACKERS_GRID_SETTINGS } from '../models/trackers-grid.model';
import { SettingsService } from './settings.service';
import { TrackersGridSettingsService } from './trackers-grid.settings.service';

describe('TrackersGridSettingsService', () => {
  let service: TrackersGridSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        TrackersGridSettingsService,
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });

    service = TestBed.inject(TrackersGridSettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have a non-empty string settings ID', () => {
    expect(typeof (service as any).SETTINGS_ID).toBe('string');
    expect((service as any).SETTINGS_ID.length).toBeGreaterThan(0);
  });

  it('should return default settings when nothing is stored', async () => {
    const settings = await service.load();
    expect(settings).toEqual(DEFAULT_TRACKERS_GRID_SETTINGS);
  });

  it('default column state has 8 entries', async () => {
    const settings = await service.load();
    expect(settings.columnState).toHaveLength(8);
  });

  it('every default column has a colId', async () => {
    const settings = await service.load();
    expect(settings.columnState.every((c) => !!c.colId)).toBe(true);
  });

  it('default column state covers expected colIds', async () => {
    const settings = await service.load();
    const ids = settings.columnState.map((c) => c.colId);
    expect(ids).toEqual(
      expect.arrayContaining([
        'tier',
        'url',
        'status',
        'num_peers',
        'num_seeds',
        'num_leeches',
        'num_downloaded',
        'msg',
      ]),
    );
  });

  it('should merge stored column state over defaults', async () => {
    const stored = [{ colId: 'tier', hide: true, width: 50 }];
    mockSettingsService.get.mockResolvedValue({ columnState: stored });
    const settings = await service.load();
    expect(settings.columnState).toEqual(stored);
  });

  it('should save column state under the service settings ID', async () => {
    const columnState = [{ colId: 'url', hide: false }];
    await service.save({ columnState, floatingFilters: false });
    expect(mockSettingsService.set).toHaveBeenCalledWith((service as any).SETTINGS_ID, {
      columnState,
      floatingFilters: false,
    });
  });

  it('should emit settings via asObservable after load', async () => {
    const emitted: any[] = [];
    service.asObservable().subscribe((s) => emitted.push(s));
    await service.load();
    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted[0]).toEqual(DEFAULT_TRACKERS_GRID_SETTINGS);
  });
});
