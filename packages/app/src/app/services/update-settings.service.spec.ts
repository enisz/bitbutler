import { TestBed } from '@angular/core/testing';
import { DEFAULT_UPDATE_SETTINGS, UpdateSettings } from '../models/update-settings.model';
import { SettingsService } from './settings.service';
import { UpdateSettingsService } from './update-settings.service';

describe('UpdateSettingsService', () => {
  let service: UpdateSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        UpdateSettingsService,
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });

    service = TestBed.inject(UpdateSettingsService);
  });

  it('should return default settings when nothing is stored', async () => {
    const settings = await service.load();
    expect(settings).toEqual(DEFAULT_UPDATE_SETTINGS);
  });

  it('should return the stored skipped version', async () => {
    const stored: UpdateSettings = { skippedVersion: '1.3.0' };
    mockSettingsService.get.mockResolvedValue(stored);
    const settings = await service.load();
    expect(settings.skippedVersion).toBe('1.3.0');
  });

  it('should persist a skipped version via save', async () => {
    await service.save({ skippedVersion: '1.3.0' });
    expect(mockSettingsService.set).toHaveBeenCalledWith('UpdateSettingsService', {
      skippedVersion: '1.3.0',
    });
  });
});
