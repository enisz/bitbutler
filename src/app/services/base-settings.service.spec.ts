import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BaseSettingsService } from './base-settings.service';
import { SettingsService } from './settings.service';

interface TestSettings {
  value: string;
  count: number;
}

@Injectable()
class TestSettingsService extends BaseSettingsService<TestSettings> {
  protected readonly SETTINGS_ID = 'test-settings-id';
  protected readonly DEFAULT_SETTINGS: TestSettings = { value: 'default', count: 0 };
}

describe('BaseSettingsService', () => {
  let service: TestSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [TestSettingsService, { provide: SettingsService, useValue: mockSettingsService }],
    });

    service = TestBed.inject(TestSettingsService);
  });

  it('should return default settings when no stored value exists', async () => {
    mockSettingsService.get.mockResolvedValue(null);
    const settings = await service.load();
    expect(settings).toEqual({ value: 'default', count: 0 });
  });

  it('should persist defaults when no stored value exists', async () => {
    mockSettingsService.get.mockResolvedValue(null);
    await service.load();
    expect(mockSettingsService.set).toHaveBeenCalledWith('test-settings-id', {
      value: 'default',
      count: 0,
    });
  });

  it('should merge stored settings over defaults', async () => {
    mockSettingsService.get.mockResolvedValue({ value: 'stored' });
    const settings = await service.load();
    expect(settings.value).toBe('stored');
    expect(settings.count).toBe(0);
  });

  it('should not persist when stored value already exists', async () => {
    mockSettingsService.get.mockResolvedValue({ value: 'stored', count: 5 });
    await service.load();
    expect(mockSettingsService.set).not.toHaveBeenCalled();
  });

  it('should return the same promise on repeated load() calls', () => {
    const p1 = service.load();
    const p2 = service.load();
    expect(p1).toBe(p2);
  });

  it('should reload after reload() is called', async () => {
    mockSettingsService.get.mockResolvedValue(null);
    const p1 = service.load();
    service.reload();
    const p2 = service.load();
    expect(p1).not.toBe(p2);
  });

  it('should save new settings and emit them', async () => {
    const newSettings: TestSettings = { value: 'new', count: 42 };
    await service.save(newSettings);
    expect(mockSettingsService.set).toHaveBeenCalledWith('test-settings-id', newSettings);
  });

  it('should emit settings via asObservable() and trigger load', async () => {
    mockSettingsService.get.mockResolvedValue({ value: 'from-obs', count: 1 });
    const values: TestSettings[] = [];
    service.asObservable().subscribe((s) => values.push(s));
    await service.load();
    expect(values.length).toBeGreaterThan(0);
    expect(values[0].value).toBe('from-obs');
  });

  it('should clear loadPromise and rethrow on error', async () => {
    mockSettingsService.get.mockRejectedValue(new Error('storage error'));
    await expect(service.load()).rejects.toThrow('storage error');
    // After error, load() should try again
    mockSettingsService.get.mockResolvedValue(null);
    const settings = await service.load();
    expect(settings).toEqual({ value: 'default', count: 0 });
  });
});
