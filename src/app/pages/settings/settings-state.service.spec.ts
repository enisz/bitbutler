// src/app/pages/settings/settings-state.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { SettingsStateService } from './settings-state.service';

describe('SettingsStateService', () => {
  let service: SettingsStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SettingsStateService],
    });
    service = TestBed.inject(SettingsStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('isDirty', () => {
    it('should be false initially', () => {
      expect(service.isDirty()).toBe(false);
    });

    it('should be true after any tab is marked dirty', () => {
      service.markDirty('general', true);
      expect(service.isDirty()).toBe(true);
    });

    it('should be false once the dirty tab is cleaned', () => {
      service.markDirty('general', true);
      service.markDirty('general', false);
      expect(service.isDirty()).toBe(false);
    });
  });

  describe('isDirtyMap', () => {
    it('should start with all tabs clean', () => {
      expect(Object.values(service.isDirtyMap()).every((v) => !v)).toBe(true);
    });

    it('should reflect per-tab dirty state', () => {
      service.markDirty('server', true);
      expect(service.isDirtyMap()['server']).toBe(true);
      expect(service.isDirtyMap()['general']).toBe(false);
    });
  });

  describe('markDirty', () => {
    it('should mark a tab dirty', () => {
      service.markDirty('torrent-list-grid', true);
      expect(service.isDirtyMap()['torrent-list-grid']).toBe(true);
    });

    it('should mark a tab clean', () => {
      service.markDirty('torrent-list-grid', true);
      service.markDirty('torrent-list-grid', false);
      expect(service.isDirtyMap()['torrent-list-grid']).toBe(false);
    });

    it('should not affect other tabs', () => {
      service.markDirty('status-bar', true);
      expect(service.isDirtyMap()['general']).toBe(false);
      expect(service.isDirtyMap()['server']).toBe(false);
    });
  });

  describe('resetDirty', () => {
    it('should reset all dirty tabs to clean', () => {
      service.markDirty('general', true);
      service.markDirty('server', true);
      service.resetDirty();
      expect(service.isDirty()).toBe(false);
    });
  });

  describe('registerSave / saveAll', () => {
    it('should call the save fn for dirty tabs', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('general', fn);
      service.markDirty('general', true);
      await service.saveAll();
      expect(fn).toHaveBeenCalledOnce();
    });

    it('should not call the save fn for clean tabs', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('server', fn);
      await service.saveAll();
      expect(fn).not.toHaveBeenCalled();
    });

    it('should reset dirty state after saving', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('general', fn);
      service.markDirty('general', true);
      await service.saveAll();
      expect(service.isDirty()).toBe(false);
    });

    it('should call save fns for every dirty tab', async () => {
      const genFn = vi.fn().mockResolvedValue(undefined);
      const srvFn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('general', genFn);
      service.registerSave('server', srvFn);
      service.markDirty('general', true);
      service.markDirty('server', true);
      await service.saveAll();
      expect(genFn).toHaveBeenCalledOnce();
      expect(srvFn).toHaveBeenCalledOnce();
    });

    it('should resolve without throwing when no fn is registered for a dirty tab', async () => {
      service.markDirty('general', true);
      await expect(service.saveAll()).resolves.not.toThrow();
    });
  });
});
