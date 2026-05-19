import { TestBed } from '@angular/core/testing';
import { QbSettingsStateService } from './qb-settings-state.service';

const MOCK_PREFS: any = { dl_limit: 0, save_path: '/tmp' };

describe('QbSettingsStateService', () => {
  let service: QbSettingsStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [QbSettingsStateService] });
    service = TestBed.inject(QbSettingsStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('preferences', () => {
    it('should be null initially', () => {
      expect(service.preferences()).toBeNull();
    });

    it('should be set after setPreferences is called', () => {
      service.setPreferences(MOCK_PREFS);
      expect(service.preferences()).toBe(MOCK_PREFS);
    });
  });

  describe('isDirty', () => {
    it('should be false initially', () => {
      expect(service.isDirty()).toBe(false);
    });

    it('should be true after any tab is marked dirty', () => {
      service.markDirty('bandwidth', true);
      expect(service.isDirty()).toBe(true);
    });

    it('should be false once the dirty tab is cleaned', () => {
      service.markDirty('bandwidth', true);
      service.markDirty('bandwidth', false);
      expect(service.isDirty()).toBe(false);
    });
  });

  describe('isDirtyMap', () => {
    it('should start with all tabs clean', () => {
      expect(Object.values(service.isDirtyMap()).every((v) => !v)).toBe(true);
    });

    it('should reflect per-tab dirty state', () => {
      service.markDirty('storage', true);
      expect(service.isDirtyMap()['storage']).toBe(true);
      expect(service.isDirtyMap()['bandwidth']).toBe(false);
    });
  });

  describe('resetDirty', () => {
    it('should reset all dirty tabs to clean', () => {
      service.markDirty('bandwidth', true);
      service.markDirty('storage', true);
      service.resetDirty();
      expect(service.isDirty()).toBe(false);
    });
  });

  describe('registerSave / saveAll', () => {
    it('should call the save fn for dirty tabs only', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('bandwidth', fn);
      service.markDirty('bandwidth', true);
      await service.saveAll();
      expect(fn).toHaveBeenCalledOnce();
    });

    it('should not call save fn for clean tabs', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('storage', fn);
      await service.saveAll();
      expect(fn).not.toHaveBeenCalled();
    });

    it('should reset dirty state after saving', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('bandwidth', fn);
      service.markDirty('bandwidth', true);
      await service.saveAll();
      expect(service.isDirty()).toBe(false);
    });

    it('should call save fns for every dirty tab', async () => {
      const bwFn = vi.fn().mockResolvedValue(undefined);
      const stFn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('bandwidth', bwFn);
      service.registerSave('storage', stFn);
      service.markDirty('bandwidth', true);
      service.markDirty('storage', true);
      await service.saveAll();
      expect(bwFn).toHaveBeenCalledOnce();
      expect(stFn).toHaveBeenCalledOnce();
    });

    it('should resolve without throwing when no fn is registered for a dirty tab', async () => {
      service.markDirty('bandwidth', true);
      await expect(service.saveAll()).resolves.not.toThrow();
    });
  });
});
