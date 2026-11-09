import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { AppPlatform } from '@bitbutler/shared';
import { PlatformService } from '../services/platform.service';

/** Allows the route only on the required platform, otherwise redirects to the other platform's settings. */
export const platformGuard =
  (required: AppPlatform): CanActivateFn =>
  () => {
    if (inject(PlatformService).platform === required) return true;

    return inject(Router).parseUrl(
      required === 'desktop' ? '/pages/mobile-settings' : '/pages/settings',
    );
  };
