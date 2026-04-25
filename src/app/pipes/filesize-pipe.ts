import { Pipe, PipeTransform } from '@angular/core';
import { formatBytes } from './format-bytes';

@Pipe({
  name: 'fileSize',
  standalone: true,
})
export class FilesizePipe implements PipeTransform {
  transform(value: number | bigint | string | null | undefined): string {
    return formatBytes(value);
  }
}
