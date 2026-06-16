import { Pipe, PipeTransform } from '@angular/core';
import { formatBytesPerSec } from './format-bytes';

@Pipe({
  name: 'fileSizePerSec',
  standalone: true,
})
export class FileSizePerSecPipe implements PipeTransform {
  transform(value: number | bigint | string | null | undefined): string {
    if (!value) return '';
    return formatBytesPerSec(value);
  }
}
