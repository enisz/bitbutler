import { formatDate } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DEFAULT_LOCALE,
  GeneralSettings,
  resolveDateFormat,
  resolveFirstDayOfWeek,
} from '../models/general-settings.model';
import { GeneralSettingsService } from './general-settings.service';

const ISO_FALLBACK_PATTERN = 'yyyy-MM-dd HH:mm';
const ISO_FALLBACK_DATE_PATTERN = 'yyyy-MM-dd';

@Injectable({ providedIn: 'root' })
export class DateFormatService {
  private readonly generalSettingsService = inject(GeneralSettingsService);

  private readonly _pattern = signal(ISO_FALLBACK_PATTERN);
  private readonly _datePattern = signal(ISO_FALLBACK_DATE_PATTERN);
  private readonly _locale = signal(DEFAULT_LOCALE);
  private readonly _firstDayOfWeek = signal(1);

  public readonly resolved = computed(() => ({
    pattern: this._pattern(),
    datePattern: this._datePattern(),
    locale: this._locale(),
    firstDayOfWeek: this._firstDayOfWeek(),
  }));

  public async init(): Promise<void> {
    const settings = await this.generalSettingsService.load();
    this.applyFromSettings(settings);
  }

  public applyFromSettings(settings: GeneralSettings): void {
    const { pattern, datePattern, locale } = resolveDateFormat(settings);
    this._pattern.set(pattern);
    this._datePattern.set(datePattern);
    this._locale.set(locale);
    this._firstDayOfWeek.set(resolveFirstDayOfWeek(settings));
  }

  public format(value: number | string | undefined): string {
    if (!value) return '';

    let date: Date;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      // If it's a finite number, use it only if > 0
      if (numeric <= 0) return '';
      date = new Date(numeric * 1000);
    } else if (typeof value === 'string') {
      // Only try ISO parse if the numeric parse gave NaN
      const parsed = Date.parse(value);
      if (Number.isNaN(parsed)) return '';
      date = new Date(parsed);
    } else {
      return '';
    }

    try {
      return formatDate(date, this._pattern(), this._locale());
    } catch (error) {
      console.warn('[date-format] failed to format date, falling back to ISO default', error);
      return formatDate(date, ISO_FALLBACK_PATTERN, 'en-US');
    }
  }
}
