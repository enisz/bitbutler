import { TestBed } from '@angular/core/testing';
import { DEFAULT_GENERAL_SETTINGS } from '../models/general-settings.model';
import { GeneralSettingsService } from './general-settings.service';
import { SettingsService } from './settings.service';

describe('GeneralSettingsService', () => {
  let service: GeneralSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        GeneralSettingsService,
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });

    service = TestBed.inject(GeneralSettingsService);
  });

  it('should return default settings when nothing is stored', async () => {
    const settings = await service.load();
    expect(settings).toEqual(DEFAULT_GENERAL_SETTINGS);
  });

  it('should merge stored settings over defaults', async () => {
    mockSettingsService.get.mockResolvedValue({
      behavior: { toastPosition: 'top-left', deleteTorrentFile: false, automaticUpdate: false },
    });
    const settings = await service.load();
    expect(settings.behavior.toastPosition).toBe('top-left');
    expect(settings.language).toEqual(DEFAULT_GENERAL_SETTINGS.language);
  });

  it('should save and retrieve updated settings', async () => {
    await service.save({
      ...DEFAULT_GENERAL_SETTINGS,
      behavior: { ...DEFAULT_GENERAL_SETTINGS.behavior, toastPosition: 'top-right' },
    });
    expect(mockSettingsService.set).toHaveBeenCalled();
    const saved = mockSettingsService.set.mock.calls[0][1];
    expect(saved.behavior.toastPosition).toBe('top-right');
  });
});
