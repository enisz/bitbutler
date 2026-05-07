import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'localTimestamp',
  standalone: true,
})
export class LocalTimestampPipe implements PipeTransform {
  transform(value: number | string | undefined): string {
    if (!value || Number(value) <= 0) return '';

    const date = new Date(Number(value) * 1000);
    const pad = (num: number) => String(num).padStart(2, '0');

    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  }
}
