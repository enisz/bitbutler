import { Injectable } from '@angular/core';
import type { AppPlatform } from '@bitbutler/shared';
import { environment } from '../../environments/environment';

function resolvePlatform(value: unknown): AppPlatform {
  return value === 'desktop' || value === 'mobile' ? value : environment.appPlatform;
}

@Injectable({ providedIn: 'root' })
export class PlatformService {
  readonly platform: AppPlatform = resolvePlatform(window.bitbutler?.appPlatform);
  readonly isMobile = this.platform === 'mobile';
  readonly isDesktop = this.platform === 'desktop';
  readonly settingsPath: '/pages/mobile-settings' | '/pages/settings' = this.isMobile
    ? '/pages/mobile-settings'
    : '/pages/settings';
}
