import { Injectable, effect, inject, signal } from '@angular/core';
import { GeneralSettingsService } from './general-settings.service';

export type ThemeFamily =
  | 'bitbutler'
  | 'aurora'
  | 'mint-green'
  | 'purple-haze'
  | 'ocean-breeze'
  | 'pumpkin-spice'
  | 'deep-sea'
  | 'crimson-ember'
  | 'teal-blush'
  | 'dusty-rose'
  | 'graphite'
  | 'meadow'
  | 'sunset'
  | 'raspberry';
export type ThemeMode = 'light' | 'dark' | 'system';

// BitButler first, then the rest alphabetically by label.
export const THEME_FAMILIES: { value: ThemeFamily; label: string }[] = [
  { value: 'bitbutler', label: 'BitButler' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'crimson-ember', label: 'Crimson Ember' },
  { value: 'deep-sea', label: 'Deep Sea' },
  { value: 'dusty-rose', label: 'Dusty Rose' },
  { value: 'graphite', label: 'Graphite' },
  { value: 'meadow', label: 'Meadow' },
  { value: 'mint-green', label: 'Mint Green' },
  { value: 'ocean-breeze', label: 'Ocean Breeze' },
  { value: 'pumpkin-spice', label: 'Pumpkin Spice' },
  { value: 'purple-haze', label: 'Purple Haze' },
  { value: 'raspberry', label: 'Raspberry' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'teal-blush', label: 'Teal Blush' },
];

// Mirrors each family's $..._light-secondary SCSS variable (packages/app/src/styles/themes/<family>/_light.scss) -
// kept here so BbLogo can render a theme's accent color without switching the active theme.
export const FAMILY_ACCENT_COLORS: Record<ThemeFamily, string> = {
  bitbutler: '#c7a57a',
  aurora: '#2bb3b1',
  'mint-green': '#a3b18a',
  'purple-haze': '#ab47bc',
  'ocean-breeze': '#03a9f4',
  'pumpkin-spice': '#f39c12',
  'deep-sea': '#088395',
  'crimson-ember': '#f08a5d',
  'teal-blush': '#436e6f',
  'dusty-rose': '#735e62',
  graphite: '#b90a00',
  meadow: '#4f8a47',
  sunset: '#bc5090',
  raspberry: '#c40051',
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _family = signal<ThemeFamily>('bitbutler');
  private readonly _mode = signal<ThemeMode>('system');
  private readonly _effective = signal<'light' | 'dark'>(this.getSystemMode());

  public readonly family = this._family.asReadonly();
  public readonly mode = this._mode.asReadonly();
  public readonly effectiveMode = this._effective.asReadonly();

  private readonly generalSettingsService = inject(GeneralSettingsService);

  constructor() {
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (this._mode() === 'system') {
        this._effective.set(this.getSystemMode());
      }
    };
    mql?.addEventListener?.('change', handleSystemChange);

    effect(() => {
      const family = this._family();
      const mode = this._mode();

      const effectiveMode = mode === 'system' ? this.getSystemMode() : mode;
      this._effective.set(effectiveMode);

      document.documentElement.setAttribute('data-bb-theme', family);
      document.documentElement.setAttribute('data-bs-theme', effectiveMode);
    });
  }

  public async init(): Promise<void> {
    const settings = await this.generalSettingsService.load();
    this._family.set(settings.appearance.family || 'bitbutler');
    this._mode.set(settings.appearance.mode || 'system');
  }

  public setFamily(family: ThemeFamily): void {
    this._family.set(family);
    this.saveSettings();
  }

  public setMode(mode: ThemeMode): void {
    this._mode.set(mode);
    this.saveSettings();
  }

  public applyFromSettings(family: ThemeFamily, mode: ThemeMode): void {
    this._family.set(family);
    this._mode.set(mode);
  }

  private async saveSettings(): Promise<void> {
    const settings = await this.generalSettingsService.load();
    settings.appearance.family = this._family();
    settings.appearance.mode = this._mode();
    await this.generalSettingsService.save(settings);
  }

  public getSystemMode(): 'light' | 'dark' {
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
  }
}
