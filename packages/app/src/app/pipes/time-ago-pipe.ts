import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'timeAgo',
  standalone: true,
})
export class TimeAgoPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(value: number | string | undefined | null): string {
    if (!value || Number(value) <= 0) return '';

    const locale = this.translate.getCurrentLang() || 'en-US';
    const diffSec = (Number(value) * 1000 - Date.now()) / 1000;
    const abs = Math.abs(diffSec);

    let amount: number;
    let unit: Intl.RelativeTimeFormatUnit;

    if (abs < 60) {
      amount = Math.round(diffSec);
      unit = 'second';
    } else if (abs < 3600) {
      amount = Math.round(diffSec / 60);
      unit = 'minute';
    } else if (abs < 86400) {
      amount = Math.round(diffSec / 3600);
      unit = 'hour';
    } else if (abs < 604800) {
      amount = Math.round(diffSec / 86400);
      unit = 'day';
    } else if (abs < 2592000) {
      amount = Math.round(diffSec / 604800);
      unit = 'week';
    } else if (abs < 31536000) {
      amount = Math.round(diffSec / 2592000);
      unit = 'month';
    } else {
      amount = Math.round(diffSec / 31536000);
      unit = 'year';
    }

    try {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(amount, unit);
    } catch {
      return new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' }).format(amount, unit);
    }
  }
}
