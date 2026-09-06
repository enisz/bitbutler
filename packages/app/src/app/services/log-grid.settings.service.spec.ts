import { TestBed } from '@angular/core/testing';
import { LogGridSettingsService } from './log-grid.settings.service';
import { SettingsService } from './settings.service';

describe('LogGridSettingsService', () => {
  let service: LogGridSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        LogGridSettingsService,
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });

    service = TestBed.inject(LogGridSettingsService);
  });

  it('returns default settings with expected shape when nothing is stored', async () => {
    const settings = await service.load();
    expect(settings).toEqual({ columnState: null, colorCodingEnabled: false, compactRows: false });
  });

  it('persists settings under the LogGridSettingsService id', async () => {
    await service.save({
      columnState: [{ colId: 'message' }],
      colorCodingEnabled: true,
      compactRows: false,
    } as any);
    expect(mockSettingsService.set).toHaveBeenCalledWith('LogGridSettingsService', {
      columnState: [{ colId: 'message' }],
      colorCodingEnabled: true,
      compactRows: false,
    });
  });

  it('merges stored settings over the defaults', async () => {
    mockSettingsService.get.mockResolvedValue({ colorCodingEnabled: true });
    const settings = await service.load();
    expect(settings.colorCodingEnabled).toBe(true);
    expect(settings.columnState).toBeNull();
  });
});
