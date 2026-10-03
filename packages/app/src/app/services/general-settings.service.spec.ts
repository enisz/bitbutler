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

  it('should default every OS notification to enabled and not minimized-only', async () => {
    const { os } = (await service.load()).notifications;
    expect(os).toEqual({
      enabled: true,
      onlyWhenMinimized: false,
      finished: true,
      errors: true,
      updates: true,
    });
  });

  it('should merge stored settings over defaults', async () => {
    mockSettingsService.get.mockResolvedValue({
      notifications: { app: { position: 'top-left' } },
      behavior: { deleteTorrentFile: false, automaticUpdate: false },
    });
    const settings = await service.load();
    expect(settings.notifications.app.position).toBe('top-left');
    expect(settings.language).toEqual(DEFAULT_GENERAL_SETTINGS.language);
  });

  it('should fill missing notification keys from defaults when a partial block is stored', async () => {
    mockSettingsService.get.mockResolvedValue({ notifications: { os: { enabled: false } } });
    const { notifications } = await service.load();
    expect(notifications.os.enabled).toBe(false);
    expect(notifications.os.finished).toBe(true);
    expect(notifications.app).toEqual(DEFAULT_GENERAL_SETTINGS.notifications.app);
  });

  it('should migrate the legacy behavior.toastPosition into notifications.app.position', async () => {
    mockSettingsService.get.mockResolvedValue({
      behavior: { deleteTorrentFile: false, toastPosition: 'top-left' },
    });
    const settings = await service.load();
    expect(settings.notifications.app.position).toBe('top-left');
    expect(settings.notifications.os).toEqual(DEFAULT_GENERAL_SETTINGS.notifications.os);
    expect(settings.behavior.deleteTorrentFile).toBe(false);
    expect('toastPosition' in settings.behavior).toBe(false);
  });

  it('should prefer an already stored notifications.app.position over the legacy value', async () => {
    mockSettingsService.get.mockResolvedValue({
      behavior: { toastPosition: 'top-left' },
      notifications: { app: { position: 'bottom-left' } },
    });
    const settings = await service.load();
    expect(settings.notifications.app.position).toBe('bottom-left');
  });

  it('should save and retrieve updated settings', async () => {
    await service.save({
      ...DEFAULT_GENERAL_SETTINGS,
      notifications: {
        ...DEFAULT_GENERAL_SETTINGS.notifications,
        app: { ...DEFAULT_GENERAL_SETTINGS.notifications.app, position: 'top-right' },
      },
    });
    expect(mockSettingsService.set).toHaveBeenCalled();
    const saved = mockSettingsService.set.mock.calls[0][1];
    expect(saved.notifications.app.position).toBe('top-right');
  });
});
