import { Injectable, effect, signal } from '@angular/core';

export type Theme =
  | 'bitbutler'
  | 'aurora'
  | 'mint-green'
  | 'purple-haze'
  | 'ocean-breeze'
  | 'pumpkin-spice'
  | 'deep-sea'
  | 'crimson-ember';

const STORAGE_KEY = 'bb-docs-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>((localStorage.getItem(STORAGE_KEY) as Theme) ?? 'bitbutler');

  constructor() {
    effect(() => {
      const t = this.theme();
      document.documentElement.setAttribute('data-bb-theme', t);
      document.documentElement.setAttribute('data-bs-theme', 'dark');
      localStorage.setItem(STORAGE_KEY, t);
    });
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
  }
}
