import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCalendarDay,
  faCheck,
  faChevronLeft,
  faChevronRight,
  faEraser,
} from '@fortawesome/free-solid-svg-icons';
import {
  NgbCalendar,
  NgbDate,
  NgbDateStruct,
  NgbDatepicker,
  NgbDatepickerI18n,
  NgbDatepickerModule,
  NgbDatepickerNavigateEvent,
} from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IAfterGuiAttachedParams, IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import { CustomDatepickerI18n } from '../../../services/custom-datepicker-i18n.service';
import { DateFormatService } from '../../../services/date-format.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { createFilterInstanceId } from '../filter-instance-id.utils';
import { AG_GRID_CUSTOM_POPUP_CLASS } from '../operator-filter-base';

interface DateRangeFilterModel {
  from: NgbDate | null;
  to: NgbDate | null;
}

export interface DatepickerRangeFilterParams extends IFilterParams {
  getMinDate?: () => Date | null;
  getMaxDate?: () => Date | null;
}

/** The subset of `NgbDatepicker` this component actually drives. */
type NavigableDatepicker = Pick<NgbDatepicker, 'navigateTo'>;

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
export class DatepickerRangeFilter implements IFilterAngularComp, OnInit, OnDestroy {
  readonly calendarService = inject(NgbCalendar);
  private readonly i18n = inject(NgbDatepickerI18n);
  readonly dateFormatService = inject(DateFormatService);
  private params!: DatepickerRangeFilterParams;
  public readonly instanceId = createFilterInstanceId('datepicker-range-filter');
  /**
   * The month and year selects each need their own portal element. ng-select's overlay/Popover
   * machinery gets confused when two independent select instances share a single appendTo host -
   * opening one after the other can leave a stale, invisible overlay layer behind that swallows
   * clicks on the second select's options (they appear normal but do nothing).
   */
  private monthPopupPortal?: HTMLElement;
  private yearPopupPortal?: HTMLElement;
  public icons = { faChevronLeft, faChevronRight, faCalendarDay, faEraser, faCheck };
  fromDate: NgbDate | null = null;
  toDate: NgbDate | null = null;
  appliedFrom: NgbDate | null = null;
  appliedTo: NgbDate | null = null;
  hoveredDate: NgbDate | null = null;
  today: NgbDate;
  viewDate: { month: number; year: number };
  months: { value: number; label: string }[] = [];
  years: number[] = [];
  minDate: NgbDate | null = null;
  maxDate: NgbDate | null = null;
  /**
   * `visibleMonths()` is bound directly in the template ([items]="visibleMonths()"), which is
   * ng-select's `items` signal input - a new array reference on every call re-fires ng-select's
   * internal items effect even while its dropdown is open, resetting the hovered/marked option
   * mid-interaction (hover highlight never sticks, clicks land on a just-rebuilt item list).
   * Caching by viewed year keeps the reference stable across change-detection passes that don't
   * actually change which months should be visible.
   */
  private visibleMonthsCache: { value: number; label: string }[] = [];
  private visibleMonthsCacheYear: number | null = null;

  get monthPopupPortalSelector(): string {
    return `#${this.instanceId}-month-popup-portal`;
  }

  get yearPopupPortalSelector(): string {
    return `#${this.instanceId}-year-popup-portal`;
  }

  isOutOfRange = (date: NgbDateStruct): boolean => {
    const ngbDate = new NgbDate(date.year, date.month, date.day);
    if (this.minDate && ngbDate.before(this.minDate)) return true;
    if (this.maxDate && ngbDate.after(this.maxDate)) return true;
    return false;
  };

  constructor() {
    this.today = this.calendarService.getToday();
    this.viewDate = { month: this.today.month, year: this.today.year };
  }

  ngOnInit(): void {
    this.months = Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: this.i18n.getMonthFullName(i + 1),
    }));
    this.buildYears();
  }

  agInit(params: DatepickerRangeFilterParams): void {
    this.params = params;
    this.refreshDateBounds();

    this.monthPopupPortal = this.createPopupPortal(this.monthPopupPortalSelector);
    this.yearPopupPortal = this.createPopupPortal(this.yearPopupPortalSelector);
  }

  /**
   * The underlying data (e.g. the torrent list) can change between filter popup openings, so the
   * min/max bounds computed at agInit time can go stale - re-derive them on every reopen too,
   * otherwise a newly-added row's date can end up permanently disabled.
   */
  private refreshDateBounds(): void {
    const min = this.params.getMinDate?.() ?? null;
    const max = this.params.getMaxDate?.() ?? null;
    this.minDate = min ? this.dateToNgb(min) : null;
    this.maxDate = max ? this.dateToNgb(max) : null;
    this.buildYears();
    this.visibleMonthsCacheYear = null;
  }

  private buildYears(): void {
    const currentYear = this.today.year;
    const startYear = this.minDate?.year ?? currentYear - 20;
    const endYear = this.maxDate?.year ?? currentYear + 10;
    this.years = [];
    for (let i = startYear; i <= endYear; i++) {
      this.years.push(i);
    }
  }

  ngOnDestroy(): void {
    this.monthPopupPortal?.remove();
    this.yearPopupPortal?.remove();
  }

  private createPopupPortal(idSelector: string): HTMLElement {
    const portal = document.createElement('div');
    portal.id = idSelector.slice(1);
    portal.className = AG_GRID_CUSTOM_POPUP_CLASS;
    portal.style.position = 'relative';
    document.body.appendChild(portal);
    return portal;
  }
  isFilterActive(): boolean {
    return this.appliedFrom !== null;
  }
  visibleMonths(): { value: number; label: string }[] {
    if (this.viewDate.year !== this.visibleMonthsCacheYear) {
      this.visibleMonthsCacheYear = this.viewDate.year;
      this.visibleMonthsCache = this.months.filter((m) => {
        if (
          this.minDate &&
          this.viewDate.year === this.minDate.year &&
          m.value < this.minDate.month
        )
          return false;
        if (
          this.maxDate &&
          this.viewDate.year === this.maxDate.year &&
          m.value > this.maxDate.month
        )
          return false;
        return true;
      });
    }
    return this.visibleMonthsCache;
  }
  private dateToNgb(d: Date): NgbDate {
    return new NgbDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.appliedFrom) return true;
    const rawValue = this.params.getValue(params.node);
    if (rawValue == null) return false;
    const cellDate = new Date(Number(rawValue) * 1000);
    const cellLocalMidnight = new Date(
      cellDate.getFullYear(),
      cellDate.getMonth(),
      cellDate.getDate(),
    ).getTime();
    const from = this.ngbToLocalMidnight(this.appliedFrom);
    if (this.appliedTo) {
      const to = this.ngbToLocalMidnight(this.appliedTo);
      return cellLocalMidnight >= from && cellLocalMidnight <= to;
    }
    return cellLocalMidnight === from;
  }
  getModel(): DateRangeFilterModel | null {
    return this.isFilterActive() ? { from: this.appliedFrom, to: this.appliedTo } : null;
  }
  setModel(model: DateRangeFilterModel | null): void {
    this.appliedFrom = model?.from ?? null;
    this.appliedTo = model?.to ?? null;
    this.fromDate = this.appliedFrom;
    this.toDate = this.appliedTo;
  }
  afterGuiAttached(_params?: IAfterGuiAttachedParams): void {
    this.refreshDateBounds();
    this.fromDate = this.appliedFrom;
    this.toDate = this.appliedTo;
    this.hoveredDate = null;
  }
  updateView(dp: NavigableDatepicker) {
    dp.navigateTo(this.viewDate);
  }
  moveMonth(dp: NavigableDatepicker, step: number) {
    const nextDate = this.calendarService.getNext(
      new NgbDate(this.viewDate.year, this.viewDate.month, 1),
      'm',
      step,
    );
    this.viewDate = { month: nextDate.month, year: nextDate.year };
    dp.navigateTo(this.viewDate);
  }
  selectToday(dp: NavigableDatepicker) {
    this.fromDate = this.today;
    this.toDate = null;
    this.hoveredDate = null;
    this.viewDate = { month: this.today.month, year: this.today.year };
    dp.navigateTo(this.today);
  }
  onNavigate(event: NgbDatepickerNavigateEvent) {
    this.viewDate = { month: event.next.month, year: event.next.year };
  }
  onSelect(date: NgbDate) {
    if (!this.fromDate && !this.toDate) {
      this.fromDate = date;
    } else if (this.fromDate && !this.toDate && date.after(this.fromDate)) {
      this.toDate = date;
    } else {
      this.toDate = null;
      this.fromDate = date;
    }
  }
  apply() {
    this.appliedFrom = this.fromDate;
    this.appliedTo = this.toDate;
    this.params.filterChangedCallback();
    this.params.api.hidePopupMenu();
  }
  isApplyDisabled(): boolean {
    return (
      this.datesEqual(this.fromDate, this.appliedFrom) &&
      this.datesEqual(this.toDate, this.appliedTo)
    );
  }
  clear() {
    this.fromDate = null;
    this.toDate = null;
    this.hoveredDate = null;
    this.appliedFrom = null;
    this.appliedTo = null;
    this.params.filterChangedCallback();
    this.params.api.hidePopupMenu();
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
  private datesEqual(a: NgbDate | null, b: NgbDate | null): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.equals(b);
  }
  private ngbToLocalMidnight(d: NgbDate): number {
    return new Date(d.year, d.month - 1, d.day).getTime();
  }
}
