import { Injectable, inject } from '@angular/core';
import { NgbDateStruct, NgbDatepickerI18n } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class CustomDatepickerI18n extends NgbDatepickerI18n {
  private translate = inject(TranslateService);

  getWeekdayLabel(weekday: number): string {
    return this.translate.instant(`general.calendar.weekdays.${weekday}`);
  }

  getMonthShortName(month: number): string {
    return this.translate.instant(`general.calendar.months.short.${month}`);
  }

  getMonthFullName(month: number): string {
    return this.translate.instant(`general.calendar.months.full.${month}`);
  }

  getDayAriaLabel(date: NgbDateStruct): string {
    return `${date.day}-${date.month}-${date.year}`;
  }
}
