import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { PlatformService } from './platform.service';

export type Layout = 'phone' | 'tablet' | 'desktop';

export const PHONE_MAX_WIDTH = 767.98;
export const TABLET_MAX_WIDTH = 1199.98;

@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly platform = inject(PlatformService);

  private readonly phone = this.watch(`(max-width: ${PHONE_MAX_WIDTH}px)`);
  private readonly tablet = this.watch(`(min-width: 768px) and (max-width: ${TABLET_MAX_WIDTH}px)`);

  public readonly isTouch = this.watch('(pointer: coarse)');

  public readonly layout = computed<Layout>(() =>
    this.platform.isMobile || this.phone() ? 'phone' : this.tablet() ? 'tablet' : 'desktop',
  );
  public readonly isPhone = computed(() => this.layout() === 'phone');
  public readonly isTablet = computed(() => this.layout() === 'tablet');
  public readonly isDesktop = computed(() => this.layout() === 'desktop');

  private watch(query: string): Signal<boolean> {
    const mql = typeof window !== 'undefined' ? window.matchMedia?.(query) : undefined;
    const state = signal(mql?.matches ?? false);
    if (mql) {
      const listener = () => state.set(mql.matches);
      mql.addEventListener('change', listener);
      this.destroyRef.onDestroy(() => mql.removeEventListener('change', listener));
    }
    return state.asReadonly();
  }
}
