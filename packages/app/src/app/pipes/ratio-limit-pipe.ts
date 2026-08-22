import { Injectable, Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
@Pipe({
  name: 'ratioLimit',
  standalone: true,
})
export class RatioLimitPipe implements PipeTransform {
  private readonly translateService = inject(TranslateService);

  transform(value: number | undefined | null): string {
    if (value === -2) {
      return this.translateService.instant('general.limit.global');
    } else if (value == null || value === -1) {
      return this.translateService.instant('general.limit.no-limit');
    } else {
      return value.toFixed(2);
    }
  }
}
