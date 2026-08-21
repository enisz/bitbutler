import { Injectable, Pipe, PipeTransform } from '@angular/core';

@Injectable({ providedIn: 'root' })
@Pipe({
  name: 'ratio',
  standalone: true,
})
export class RatioPipe implements PipeTransform {
  transform(value: number, digits: number = 2): string {
    return (value ?? 0).toFixed(digits);
  }
}
