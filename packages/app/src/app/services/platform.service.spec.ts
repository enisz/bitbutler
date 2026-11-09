import { TestBed } from '@angular/core/testing';
import { PlatformService } from './platform.service';

type TestWindow = { bitbutler?: { appPlatform?: string } };

describe('PlatformService', () => {
  const win = window as unknown as TestWindow;
  let original: TestWindow['bitbutler'];

  beforeEach(() => {
    original = win.bitbutler;
  });

  afterEach(() => {
    win.bitbutler = original;
  });

  function create(): PlatformService {
    return TestBed.inject(PlatformService);
  }

  it('defaults to desktop when window.bitbutler is undefined', () => {
    win.bitbutler = undefined;
    const service = create();
    expect(service.platform).toBe('desktop');
    expect(service.isDesktop).toBe(true);
    expect(service.isMobile).toBe(false);
  });

  it('reads mobile from window.bitbutler.appPlatform', () => {
    win.bitbutler = { appPlatform: 'mobile' };
    const service = create();
    expect(service.platform).toBe('mobile');
    expect(service.isMobile).toBe(true);
    expect(service.isDesktop).toBe(false);
  });

  it('falls back to the environment value when the preload value is absent', () => {
    win.bitbutler = {};
    expect(create().platform).toBe('desktop');
  });

  it('falls back to the environment value when the preload value is not a known platform', () => {
    win.bitbutler = { appPlatform: 'tablet' };
    const service = create();
    expect(service.platform).toBe('desktop');
    expect(service.isDesktop).toBe(true);
  });

  it('settingsPath is /pages/mobile-settings on mobile and /pages/settings on desktop', () => {
    win.bitbutler = { appPlatform: 'mobile' };
    expect(create().settingsPath).toBe('/pages/mobile-settings');
    TestBed.resetTestingModule();
    win.bitbutler = { appPlatform: 'desktop' };
    expect(create().settingsPath).toBe('/pages/settings');
  });
});
