import { Pipe, PipeTransform, inject } from '@angular/core';
import { DurationFormat } from '@formatjs/intl-durationformat';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'humanizeDuration',
  standalone: true,
  pure: false,
})
export class HumanizeDurationPipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(ms: number, style: 'long' | 'short' | 'narrow' = 'long'): string {
    const locale = this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'en-US';

    if (ms === null || ms === undefined || isNaN(ms) || ms >= 8640000) {
      return '';
    }

    const duration = {
      hours: Math.floor(ms / 3600000),
      minutes: Math.floor((ms % 3600000) / 60000),
      seconds: Math.floor((ms % 60000) / 1000),
    };

    try {
      return new DurationFormat(locale, { style }).format(duration);
    } catch (e) {
      return new DurationFormat('en-US', { style }).format(duration);
    }
  }
}
