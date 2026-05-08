import { Injectable, inject } from '@angular/core';
import type { ValueFormatterParams } from 'ag-grid-community';
import { FilesizePipe } from '../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../pipes/humanize-duration-pipe';
import { LocalTimestampPipe } from '../pipes/local-timestamp-pipe';
import { RatioLimitPipe } from '../pipes/ratio-limit-pipe';
import { RatioPipe } from '../pipes/ratio-pipe';
import { TimeLimitPipe } from '../pipes/time-limit-pipe';

@Injectable({ providedIn: 'root' })
export class UiFormatService {
  private readonly fileSizePipe = inject(FilesizePipe);
  private readonly humanizeDurationPipe = inject(HumanizeDurationPipe);
  private readonly ratioPipe = inject(RatioPipe);
  private readonly localTimestampPipe = inject(LocalTimestampPipe);
  private readonly ratioLimitPipe = inject(RatioLimitPipe);
  private readonly timeLimitPipe = inject(TimeLimitPipe);

  public readonly utcDateComparator = (
    filterLocalDateAtMidnight: Date,
    cellValue: number,
  ): number => {
    if (cellValue == null) return -1;

    const cellDate = new Date(Number(cellValue) * 1000);

    const cellYear = cellDate.getUTCFullYear();
    const cellMonth = cellDate.getUTCMonth();
    const cellDay = cellDate.getUTCDate();

    const filterYear = filterLocalDateAtMidnight.getFullYear();
    const filterMonth = filterLocalDateAtMidnight.getMonth();
    const filterDay = filterLocalDateAtMidnight.getDate();

    const cellComparisonTime = new Date(cellYear, cellMonth, cellDay).getTime();
    const filterComparisonTime = new Date(filterYear, filterMonth, filterDay).getTime();

    if (cellComparisonTime === filterComparisonTime) return 0;
    return cellComparisonTime < filterComparisonTime ? -1 : 1;
  };

  public readonly localTimestamp = (params: ValueFormatterParams): string =>
    this.localTimestampPipe.transform(params.value);

  public readonly fileSize = (params: ValueFormatterParams): string =>
    this.fileSizePipe.transform(params.value);

  public readonly fileSizePerSecond = (params: ValueFormatterParams): string =>
    `${this.fileSizePipe.transform(params.value)}/s`;

  public readonly duration = (params: ValueFormatterParams): string =>
    this.humanizeDurationPipe.transform(params.value);

  public readonly durationSeconds = (params: ValueFormatterParams, precision = Infinity): string =>
    this.humanizeDurationPipe.transform(params.value * 1000, 'long', precision);

  public readonly ratio = (params: ValueFormatterParams): string =>
    this.ratioPipe.transform(params.value);

  public readonly ratioLimit = (params: ValueFormatterParams): string =>
    this.ratioLimitPipe.transform(params.value);

  public readonly timeLimit = (params: ValueFormatterParams): string =>
    this.timeLimitPipe.transform(params.value);
}
