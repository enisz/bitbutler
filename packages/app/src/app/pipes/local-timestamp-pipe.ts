import { Pipe, PipeTransform, inject } from '@angular/core';
import { DateFormatService } from '../services/date-format.service';

@Pipe({
  name: 'localTimestamp',
  standalone: true,
  pure: false,
})
export class LocalTimestampPipe implements PipeTransform {
  private readonly dateFormatService = inject(DateFormatService);

  transform(value: number | string | null | undefined): string {
    return this.dateFormatService.format(value as number | string | undefined);
  }
}
