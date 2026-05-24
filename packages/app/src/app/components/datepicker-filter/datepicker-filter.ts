import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbDate, NgbDatepicker } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IFilterParams } from 'ag-grid-community';

@Component({
  selector: 'app-datepicker-filter',
  imports: [FormsModule, NgbDatepicker, TranslatePipe],
  templateUrl: './datepicker-filter.html',
  styleUrl: './datepicker-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatepickerFilter implements IFilterAngularComp {
  private params!: IFilterParams;
  selectedDate: NgbDate | null = null;

  public agInit(params: IFilterParams): void {
    this.params = params;
  }

  public doesFilterPass(rowParams: any): boolean {
    if (!this.selectedDate) return true;

    const raw = rowParams.data?.added_on;
    const cellValue = Number(raw);

    if (!Number.isFinite(cellValue)) return false;

    const cellDateUtc = new Date(cellValue * 1000);
    const cellYear = cellDateUtc.getUTCFullYear();
    const cellMonth = cellDateUtc.getUTCMonth();
    const cellDay = cellDateUtc.getUTCDate();

    const filterYear = this.selectedDate.year;
    const filterMonth = this.selectedDate.month - 1;
    const filterDay = this.selectedDate.day;

    const cellComparisonTime = new Date(cellYear, cellMonth, cellDay).getTime();
    const filterComparisonTime = new Date(filterYear, filterMonth, filterDay).getTime();

    return cellComparisonTime === filterComparisonTime;
  }

  public isFilterActive(): boolean {
    return !!this.selectedDate;
  }

  public onDateChanged() {
    this.params.filterChangedCallback();
  }

  public clear() {
    this.selectedDate = null;
    this.params.filterChangedCallback();
  }

  public getModel() {
    return this.selectedDate ? { date: this.selectedDate } : null;
  }

  public setModel(model: any) {
    this.selectedDate = model ? model.date : null;
  }
}
