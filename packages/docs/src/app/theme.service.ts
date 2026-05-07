import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const MODE_KEY = 'bb-docs-mode';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>((localStorage.getItem(MODE_KEY) as ThemeMode) ?? 'dark');

  private readonly systemMode = signal<'light' | 'dark'>(
    window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light',
  );

  readonly effectiveMode = computed<'light' | 'dark'>(() => {
    const mode = this.mode();
    return mode === 'system' ? this.systemMode() : mode;
  });

  constructor() {
    window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener('change', (e) => {
      this.systemMode.set(e.matches ? 'dark' : 'light');
    });

    effect(() => {
      const effectiveMode = this.effectiveMode();
      document.documentElement.setAttribute('data-bb-theme', 'bitbutler');
      document.documentElement.setAttribute('data-bs-theme', effectiveMode);
      localStorage.setItem(MODE_KEY, this.mode());
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }
}
