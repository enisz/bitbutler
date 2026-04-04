import { Pipe, PipeTransform } from '@angular/core';
import humanizeDuration from 'humanize-duration';

@Pipe({
  name: 'humanizeDuration',
  standalone: true,
})
export class HumanizeDurationPipe implements PipeTransform {
  transform(value: number): string {
    if (value >= 8640000) return '';

    return humanizeDuration((value ?? 0) * 1000, { largest: 2, round: true });
  }
}
