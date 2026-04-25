import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_STATUS_BAR_SETTINGS,
  StatusBarSettings,
} from '../models/status-bar-settings.model';
import { SettingsService } from './settings.service';
import { StatusBarSettingsService } from './status-bar-settings.service';

describe('StatusBarSettingsService', () => {
  let service: StatusBarSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        StatusBarSettingsService,
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });

    service = TestBed.inject(StatusBarSettingsService);
  });

  it('should return default settings when nothing is stored', async () => {
    const settings = await service.load();
    expect(settings).toEqual(DEFAULT_STATUS_BAR_SETTINGS);
  });

  it('should preserve array properties as-is during normalize', async () => {
    const stored: StatusBarSettings = {
      available: ['a', 'b'],
      left: ['x'],
      right: ['y', 'z'],
    };
    mockSettingsService.get.mockResolvedValue(stored);
    const settings = await service.load();
    expect(settings.available).toEqual(['a', 'b']);
    expect(settings.left).toEqual(['x']);
    expect(settings.right).toEqual(['y', 'z']);
  });

  it('should default non-array properties to empty arrays during normalize', async () => {
    mockSettingsService.get.mockResolvedValue({
      available: null,
      left: undefined,
      right: 'not-an-array',
    });
    const settings = await service.load();
    expect(settings.available).toEqual([]);
    expect(settings.left).toEqual([]);
    expect(settings.right).toEqual([]);
  });
});
