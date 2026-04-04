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
  | 'crimson-ember';
export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_FAMILY_KEY = 'bb-theme-family';
const THEME_MODE_KEY = 'bb-theme-mode';

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
