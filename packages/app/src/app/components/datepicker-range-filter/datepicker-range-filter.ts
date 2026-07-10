import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCalendarDay,
  faChevronLeft,
  faChevronRight,
  faEraser,
} from '@fortawesome/free-solid-svg-icons';
import {
  NgbCalendar,
  NgbDate,
  NgbDatepickerI18n,
  NgbDatepickerModule,
} from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import { CustomDatepickerI18n } from '../../services/custom-datepicker-i18n.service';
import { DateFormatService } from '../../services/date-format.service';
import { BbBtnContent } from '../bb-btn-content/bb-btn-content';

@Component({
  selector: 'app-datepicker-range-filter',
  standalone: true,
  imports: [
    FormsModule,
    NgbDatepickerModule,
    TranslateModule,
    NgSelectModule,
    FontAwesomeModule,
    BbBtnContent,
  ],
  providers: [{ provide: NgbDatepickerI18n, useClass: CustomDatepickerI18n }],
  templateUrl: './datepicker-range-filter.html',
  styleUrl: './datepicker-range-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatepickerRangeFilter implements IFilterAngularComp, OnInit {
  readonly calendarService = inject(NgbCalendar);
  private readonly i18n = inject(NgbDatepickerI18n);
  readonly dateFormatService = inject(DateFormatService);
  private params!: IFilterParams;
  public icons = { faChevronLeft, faChevronRight, faCalendarDay, faEraser };
  fromDate: NgbDate | null = null;
  toDate: NgbDate | null = null;
  hoveredDate: NgbDate | null = null;
  today: NgbDate;
  viewDate: { month: number; year: number };
  months: { value: number; label: string }[] = [];
  years: number[] = [];

  constructor() {
    this.today = this.calendarService.getToday();
    this.viewDate = { month: this.today.month, year: this.today.year };
  }

  ngOnInit(): void {
    this.months = Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: this.i18n.getMonthFullName(i + 1),
    }));
    const currentYear = this.today.year;
    for (let i = currentYear - 20; i <= currentYear + 10; i++) {
      this.years.push(i);
    }
  }

  agInit(params: IFilterParams): void {
    this.params = params;
  }
  isFilterActive(): boolean {
    return this.fromDate !== null;
  }
  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.fromDate) return true;
    const rawValue = params.data?.added_on;
    if (rawValue == null) return false;
    const cellDate = new Date(Number(rawValue) * 1000);
    const cellLocalMidnight = new Date(
      cellDate.getFullYear(),
      cellDate.getMonth(),
      cellDate.getDate(),
    ).getTime();
    const from = this.ngbToLocalMidnight(this.fromDate);
    if (this.toDate) {
      const to = this.ngbToLocalMidnight(this.toDate);
      return cellLocalMidnight >= from && cellLocalMidnight <= to;
    }
    return cellLocalMidnight === from;
  }
  getModel(): any {
    return this.isFilterActive() ? { from: this.fromDate, to: this.toDate } : null;
  }
  setModel(model: any): void {
    this.fromDate = model?.from ?? null;
    this.toDate = model?.to ?? null;
  }
  updateView(dp: any) {
    dp.navigateTo(this.viewDate);
  }
  moveMonth(dp: any, step: number) {
    const nextDate = this.calendarService.getNext(
      new NgbDate(this.viewDate.year, this.viewDate.month, 1),
      'm',
      step,
    );
    this.viewDate = { month: nextDate.month, year: nextDate.year };
    dp.navigateTo(this.viewDate);
  }
  onNavigate(event: any) {
    this.viewDate = { month: event.next.month, year: event.next.year };
  }
  onSelect(ev: any) {
    const date = ev as NgbDate;
    if (!this.fromDate && !this.toDate) {
      this.fromDate = date;
    } else if (this.fromDate && !this.toDate && date.after(this.fromDate)) {
      this.toDate = date;
    } else {
      this.toDate = null;
      this.fromDate = date;
    }
    this.params.filterChangedCallback();
  }
  clear() {
    this.fromDate = null;
    this.toDate = null;
    this.hoveredDate = null;
    this.params.filterChangedCallback();
  }
  isToday(date: NgbDate) {
    return date.equals(this.today);
  }
  isFrom(date: NgbDate) {
    return this.fromDate && date.equals(this.fromDate);
  }
  isTo(date: NgbDate) {
    return this.toDate && date.equals(this.toDate);
  }
  isInside(date: NgbDate) {
    return this.toDate && date.after(this.fromDate!) && date.before(this.toDate);
  }
  isHovered(date: NgbDate) {
    return (
      this.hasActiveHoverRange() && date.after(this.fromDate!) && date.before(this.hoveredDate!)
    );
  }
  isRangeStart(date: NgbDate): boolean {
    return !!this.isFrom(date) && (!!this.toDate || this.hasActiveHoverRange());
  }
  private hasActiveHoverRange(): boolean {
    return !!(
      this.fromDate &&
      !this.toDate &&
      this.hoveredDate &&
      this.hoveredDate.after(this.fromDate)
    );
  }
  isInRange(date: NgbDate) {
    return this.isFrom(date) || this.isTo(date) || this.isInside(date) || this.isHovered(date);
  }
  fmt(d: NgbDate): string {
    const { datePattern, locale } = this.dateFormatService.resolved();
    return formatDate(new Date(d.year, d.month - 1, d.day), datePattern, locale);
  }
  private ngbToLocalMidnight(d: NgbDate): number {
    return new Date(d.year, d.month - 1, d.day).getTime();
  }
}
