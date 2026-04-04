import { Pipe, PipeTransform } from '@angular/core';
import { formatBytes } from '../utils/format-bytes';

@Pipe({
  name: 'speedLimit',
  standalone: true,
})
export class SpeedLimitPipe implements PipeTransform {
  transform(limit: number): unknown {
    return limit <= 0 ? '-' : formatBytes(limit) + '/s';
  }
}
