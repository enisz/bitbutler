import { Injectable, Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { HumanizeDurationPipe } from './humanize-duration-pipe';

@Injectable({ providedIn: 'root' })
@Pipe({
  name: 'timeLimit',
})
export class TimeLimitPipe implements PipeTransform {
  private readonly humanizeDurationPipe = inject(HumanizeDurationPipe);
  private readonly translateService = inject(TranslateService);

  transform(value: number | undefined | null): string {
    if (value === -2) {
      return this.translateService.instant('general.limit.global');
    } else if (value == null || value === -1) {
      return this.translateService.instant('general.limit.no-limit');
    } else {
      return this.humanizeDurationPipe.transform(value * 60 * 1000, 'long', 2);
    }
  }
}
