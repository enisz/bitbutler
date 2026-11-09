import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import type { AppPlatform } from '@bitbutler/shared';
import { PlatformService } from '../services/platform.service';
import { platformGuard } from './platform.guard';

describe('platformGuard', () => {
  function run(required: AppPlatform, current: AppPlatform): boolean | UrlTree {
    TestBed.configureTestingModule({
      providers: [{ provide: PlatformService, useValue: { platform: current } }],
    });
    return TestBed.runInInjectionContext(() =>
      platformGuard(required)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  it('desktop guard allows desktop', () => {
    expect(run('desktop', 'desktop')).toBe(true);
  });

  it('desktop guard redirects mobile to /pages/mobile-settings', () => {
    const result = run('desktop', 'mobile');
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/pages/mobile-settings');
  });

  it('mobile guard allows mobile', () => {
    expect(run('mobile', 'mobile')).toBe(true);
  });

  it('mobile guard redirects desktop to /pages/settings', () => {
    const result = run('mobile', 'desktop');
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/pages/settings');
  });
});
