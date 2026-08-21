import { Injectable, Pipe, PipeTransform, inject } from '@angular/core';
import { DurationFormat } from '@formatjs/intl-durationformat';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
@Pipe({
  name: 'humanizeDuration',
  standalone: true,
  pure: false,
})
export class HumanizeDurationPipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(ms: number, style: 'long' | 'short' | 'narrow' = 'long', precision = Infinity): string {
    const locale = this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'en-US';

    if (ms === null || ms === undefined || isNaN(ms) || ms === 0) {
      return '';
    }

    const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;
    const MS_PER_MONTH = MS_PER_YEAR / 12;

    const duration = {
      years: Math.floor(ms / MS_PER_YEAR),
      months: Math.floor((ms % MS_PER_YEAR) / MS_PER_MONTH),
      days: Math.floor((ms % MS_PER_MONTH) / 86400000),
      hours: Math.floor((ms % 86400000) / 3600000),
      minutes: Math.floor((ms % 3600000) / 60000),
      seconds: Math.floor((ms % 60000) / 1000),
    };

    const fields = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'] as const;
    const firstNonZero = fields.findIndex((f) => duration[f] > 0);
    if (firstNonZero !== -1) {
      fields.slice(firstNonZero + precision).forEach((f) => (duration[f] = 0));
    }

    try {
      return new DurationFormat(locale, { style }).format(duration);
    } catch (e) {
      return new DurationFormat('en-US', { style }).format(duration);
    }
  }
}
