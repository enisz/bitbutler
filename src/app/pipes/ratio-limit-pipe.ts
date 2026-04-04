import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'ratioLimit',
  standalone: true,
})
export class RatioLimitPipe implements PipeTransform {
  private readonly translateService = inject(TranslateService);

  transform(value: number): string {
    if (value === -2) {
      return this.translateService.instant('pipes.ratio-limit-pipe.global');
    } else if (value === -1) {
      return this.translateService.instant('pipes.ratio-limit-pipe.no-limit');
    } else {
      return value.toFixed(2);
    }
  }
}
