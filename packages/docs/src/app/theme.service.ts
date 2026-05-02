import { Injectable, effect, signal } from '@angular/core';

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

  constructor() {
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
    mql?.addEventListener?.('change', () => {
      if (this.mode() === 'system') {
        document.documentElement.setAttribute('data-bs-theme', this.getSystemMode());
      }
    });

    effect(() => {
      const family = this.family();
      const mode = this.mode();
      const effectiveMode = mode === 'system' ? this.getSystemMode() : mode;
      document.documentElement.setAttribute('data-bb-theme', family);
      document.documentElement.setAttribute('data-bs-theme', effectiveMode);
      localStorage.setItem(FAMILY_KEY, family);
      localStorage.setItem(MODE_KEY, mode);
    });
  }

  private getSystemMode(): 'light' | 'dark' {
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
  }

  setFamily(family: ThemeFamily): void {
    this.family.set(family);
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }
}
