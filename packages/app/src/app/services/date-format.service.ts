import { formatDate } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DEFAULT_LOCALE,
  GeneralSettings,
  resolveDateFormat,
} from '../models/general-settings.model';
import { GeneralSettingsService } from './general-settings.service';

const ISO_FALLBACK_PATTERN = 'yyyy-MM-dd HH:mm';

@Injectable({ providedIn: 'root' })
export class DateFormatService {
  private readonly generalSettingsService = inject(GeneralSettingsService);

  private readonly _pattern = signal(ISO_FALLBACK_PATTERN);
  private readonly _locale = signal(DEFAULT_LOCALE);

  public readonly resolved = computed(() => ({ pattern: this._pattern(), locale: this._locale() }));

  public async init(): Promise<void> {
    const settings = await this.generalSettingsService.load();
    this.applyFromSettings(settings);
  }

  public applyFromSettings(settings: GeneralSettings): void {
    const { pattern, locale } = resolveDateFormat(settings);
    this._pattern.set(pattern);
    this._locale.set(locale);
  }

  public format(value: number | string | undefined): string {
    if (!value) return '';
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return '';

    const date = new Date(numeric * 1000);

    try {
      return formatDate(date, this._pattern(), this._locale());
    } catch (error) {
      console.warn('[date-format] failed to format date, falling back to ISO default', error);
      return formatDate(date, ISO_FALLBACK_PATTERN, 'en-US');
    }
  }
}
