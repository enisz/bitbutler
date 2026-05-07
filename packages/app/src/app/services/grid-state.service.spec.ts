import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { GridStateService } from './grid-state.service';
import { TorrentListGridSettingsService } from './torrent-list-grid.settings.service';

const makePrefs = (overrides: any = {}) => ({
  columnState: null,
  filterModel: null,
  pinnedTopHashes: [],
  pinnedBottomHashes: [],
  ...overrides,
});

describe('GridStateService', () => {
  let service: GridStateService;
  let mockGridSettingsService: any;
  let mockApi: any;

  beforeEach(() => {
    mockGridSettingsService = {
      asObservable: vi.fn().mockReturnValue(of(makePrefs())),
      save: vi.fn().mockResolvedValue(undefined),
    };

    mockApi = {
      applyColumnState: vi.fn(),
      setFilterModel: vi.fn(),
      getColumnState: vi.fn().mockReturnValue([]),
      getFilterModel: vi.fn().mockReturnValue({}),
      resetColumnState: vi.fn(),
      setGridOption: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        GridStateService,
        { provide: TorrentListGridSettingsService, useValue: mockGridSettingsService },
      ],
    });

    service = TestBed.inject(GridStateService);
  });

  it('should return false from restore() when no prefs are stored', async () => {
    mockGridSettingsService.asObservable.mockReturnValue(of(makePrefs()));
    const result = await service.restore(mockApi);
    expect(result).toBe(false);
  });

  it('should apply column state and return true when columnState is set', async () => {
    const columnState = [{ colId: 'name', hide: false }];
    mockGridSettingsService.asObservable.mockReturnValue(of(makePrefs({ columnState })));

    const result = await service.restore(mockApi);
    expect(mockApi.applyColumnState).toHaveBeenCalledWith({
      state: columnState,
      applyOrder: true,
    });
    expect(result).toBe(true);
  });

  it('should apply filter model and return true when filterModel is set', async () => {
    const filterModel = { name: { filterType: 'text', filter: 'test' } };
    mockGridSettingsService.asObservable.mockReturnValue(of(makePrefs({ filterModel })));

    const result = await service.restore(mockApi);
    expect(mockApi.setFilterModel).toHaveBeenCalledWith(filterModel);
    expect(result).toBe(true);
  });

  it('should save column state and filter model', async () => {
    mockGridSettingsService.asObservable.mockReturnValue(of(makePrefs()));
    await service.save(mockApi, ['hash1'], ['hash2']);
    expect(mockGridSettingsService.save).toHaveBeenCalledWith(
      expect.objectContaining({
        pinnedTopHashes: ['hash1'],
        pinnedBottomHashes: ['hash2'],
      }),
    );
  });

  it('should reset column state and filter model on resetToDefaults()', async () => {
    mockGridSettingsService.asObservable.mockReturnValue(of(makePrefs()));
    await service.resetToDefaults(mockApi);
    expect(mockGridSettingsService.save).toHaveBeenCalledWith(
      expect.objectContaining({ columnState: null, filterModel: null }),
    );
    expect(mockApi.setFilterModel).toHaveBeenCalledWith(null);
    expect(mockApi.resetColumnState).toHaveBeenCalled();
  });
});
