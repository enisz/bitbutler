import { TestBed } from '@angular/core/testing';
import { DEFAULT_DASHBOARD_LAYOUT } from '../models/dashboard.model';
import { DashboardSettingsService } from './dashboard-settings.service';
import { SettingsService } from './settings.service';

describe('DashboardSettingsService', () => {
  let service: DashboardSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        DashboardSettingsService,
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });

    service = TestBed.inject(DashboardSettingsService);
  });

  it('should return the default layout when nothing is stored', async () => {
    const layout = await service.load();
    expect(layout).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('should return a stored layout over the default', async () => {
    const stored = { widgets: [] };
    mockSettingsService.get.mockResolvedValue(stored);

    const layout = await service.load();
    expect(layout).toEqual(stored);
  });

  it('should persist a saved layout under its settings id', async () => {
    const next = { widgets: [] };
    await service.save(next);
    expect(mockSettingsService.set).toHaveBeenCalledWith('DashboardSettingsService', next);
  });
});
