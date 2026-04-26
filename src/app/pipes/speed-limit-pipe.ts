import { Pipe, PipeTransform } from '@angular/core';
import { formatBytes } from './format-bytes';

@Pipe({
  name: 'speedLimit',
  standalone: true,
})
export class SpeedLimitPipe implements PipeTransform {
  transform(limit: number): string {
    return limit <= 0 ? '-' : formatBytes(limit) + '/s';
  }
}
