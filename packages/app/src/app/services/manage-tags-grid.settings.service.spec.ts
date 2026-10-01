import { TestBed } from '@angular/core/testing';
import { DEFAULT_MANAGE_TAGS_GRID_SETTINGS } from '../models/manage-tags-grid.model';
import { ManageTagsGridSettingsService } from './manage-tags-grid.settings.service';
import { SettingsService } from './settings.service';

describe('ManageTagsGridSettingsService', () => {
  let service: ManageTagsGridSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        ManageTagsGridSettingsService,
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });

    service = TestBed.inject(ManageTagsGridSettingsService);
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
    expect(settings).toEqual(DEFAULT_MANAGE_TAGS_GRID_SETTINGS);
  });

  it('should merge stored column state over defaults', async () => {
    const stored = [{ colId: 'name', hide: true, width: 50 }];
    mockSettingsService.get.mockResolvedValue({ columnState: stored });
    const settings = await service.load();
    expect(settings.columnState).toEqual(stored);
  });

  it('should merge stored filter model over defaults', async () => {
    const filterModel = { name: { filterType: 'text', type: 'contains', filter: 'foo' } };
    mockSettingsService.get.mockResolvedValue({ filterModel });
    const settings = await service.load();
    expect(settings.filterModel).toEqual(filterModel);
  });

  it('should save column state and filter model under the service settings ID', async () => {
    const columnState = [{ colId: 'name', hide: false }];
    const filterModel = { name: { filterType: 'text', type: 'contains', filter: 'bar' } };
    await service.save({ columnState, filterModel });
    expect(mockSettingsService.set).toHaveBeenCalledWith((service as any).SETTINGS_ID, {
      columnState,
      filterModel,
    });
  });

  it('should emit settings via asObservable after load', async () => {
    const emitted: any[] = [];
    service.asObservable().subscribe((s) => emitted.push(s));
    await service.load();
    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted[0]).toEqual(DEFAULT_MANAGE_TAGS_GRID_SETTINGS);
  });
});
