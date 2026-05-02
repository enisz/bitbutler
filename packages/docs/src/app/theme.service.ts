import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeFamily =
  | 'bitbutler'
  | 'aurora'
  | 'mint-green'
  | 'purple-haze'
  | 'ocean-breeze'
  | 'pumpkin-spice'
  | 'deep-sea'
  | 'crimson-ember';

export type ThemeMode = 'light' | 'dark' | 'system';

const FAMILY_KEY = 'bb-docs-theme';
const MODE_KEY = 'bb-docs-mode';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly family = signal<ThemeFamily>(
    (localStorage.getItem(FAMILY_KEY) as ThemeFamily) ?? 'bitbutler',
  );
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
      const family = this.family();
      const effectiveMode = this.effectiveMode();
      document.documentElement.setAttribute('data-bb-theme', family);
      document.documentElement.setAttribute('data-bs-theme', effectiveMode);
      localStorage.setItem(FAMILY_KEY, family);
      localStorage.setItem(MODE_KEY, this.mode());
    });
  }

  setFamily(family: ThemeFamily): void {
    this.family.set(family);
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }
}
