import type { LogEntry } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { ColDef, RowClassParams, RowClassRules } from 'ag-grid-community';
import {
  DatepickerRangeFilter,
  DatepickerRangeFilterParams,
} from '../../../components/column-filters/datepicker-range-filter/datepicker-range-filter';
import { NumberColumnFilter } from '../../../components/column-filters/number-column-filter/number-column-filter';
import {
  SetColumnFilter,
  SetColumnFilterParams,
  buildValueCounts,
} from '../../../components/column-filters/set-column-filter/set-column-filter';
import { TextColumnFilter } from '../../../components/column-filters/text-column-filter/text-column-filter';
import { UiFormatService } from '../../../services/ui-format.service';

export function minLogDate(logs: readonly LogEntry[]): Date | null {
  if (logs.length === 0) return null;
  return new Date(Math.min(...logs.map((l) => l.timestamp)) * 1000);
}

export function maxLogDate(logs: readonly LogEntry[]): Date | null {
  if (logs.length === 0) return null;
  return new Date(Math.max(...logs.map((l) => l.timestamp)) * 1000);
}

const LEVEL_ROW_CLASS: Record<LogEntry['level'], string> = {
  debug: 'text-secondary-emphasis bg-secondary-subtle',
  info: 'text-info-emphasis bg-info-subtle',
  warn: 'text-warning-emphasis bg-warning-subtle',
  error: 'text-danger-emphasis bg-danger-subtle',
};

export function getLogRowClassRules(colorCodingEnabled: () => boolean): RowClassRules<LogEntry> {
  const rules: RowClassRules<LogEntry> = {};
  for (const [level, className] of Object.entries(LEVEL_ROW_CLASS) as [
    LogEntry['level'],
    string,
  ][]) {
    rules[className] = (params: RowClassParams<LogEntry>) =>
      colorCodingEnabled() && params.data?.level === level;
  }
  return rules;
}

export function getLogGridColDefs(
  uiFormatService: UiFormatService,
  translateService: TranslateService,
  getLogs: () => LogEntry[],
): ColDef<LogEntry>[] {
  return [
    {
      colId: 'timestamp',
      field: 'timestamp',
      headerName: translateService.instant('pages.logs.grid.col-def.timestamp'),
      headerTooltip: translateService.instant('pages.logs.grid.col-def.timestamp'),
      minWidth: 50,
      width: 190,
      valueFormatter: uiFormatService.localTimestamp,
      filter: DatepickerRangeFilter,
      filterParams: {
        getMinDate: () => minLogDate(getLogs()),
        getMaxDate: () => maxLogDate(getLogs()),
      } satisfies Partial<DatepickerRangeFilterParams>,
      sort: 'desc',
      cellClass: 'tabular-nums',
    },
    {
      colId: 'process',
      field: 'process',
      headerName: translateService.instant('pages.logs.grid.col-def.process'),
      headerTooltip: translateService.instant('pages.logs.grid.col-def.process'),
      minWidth: 50,
      width: 130,
      filter: SetColumnFilter,
      filterParams: {
        getItems: () => buildValueCounts(getLogs(), (l) => l.process),
      } satisfies Partial<SetColumnFilterParams>,
    },
    {
      colId: 'level',
      field: 'level',
      headerName: translateService.instant('pages.logs.grid.col-def.level'),
      headerTooltip: translateService.instant('pages.logs.grid.col-def.level'),
      minWidth: 50,
      width: 110,
      filter: SetColumnFilter,
      filterParams: {
        getItems: () => buildValueCounts(getLogs(), (l) => l.level),
      } satisfies Partial<SetColumnFilterParams>,
    },
    {
      colId: 'message',
      field: 'message',
      tooltipField: 'message',
      headerName: translateService.instant('pages.logs.grid.col-def.message'),
      headerTooltip: translateService.instant('pages.logs.grid.col-def.message'),
      minWidth: 50,
      flex: 2,
      filter: TextColumnFilter,
    },
    {
      colId: 'context',
      field: 'context',
      tooltipField: 'context',
      headerName: translateService.instant('pages.logs.grid.col-def.context'),
      headerTooltip: translateService.instant('pages.logs.grid.col-def.context'),
      minWidth: 50,
      flex: 1,
      filter: TextColumnFilter,
    },
    {
      colId: 'filename',
      field: 'filename',
      tooltipField: 'filename',
      headerName: translateService.instant('pages.logs.grid.col-def.filename'),
      headerTooltip: translateService.instant('pages.logs.grid.col-def.filename'),
      minWidth: 50,
      width: 220,
      filter: TextColumnFilter,
    },
    {
      colId: 'line',
      field: 'line',
      headerName: translateService.instant('pages.logs.grid.col-def.line'),
      headerTooltip: translateService.instant('pages.logs.grid.col-def.line'),
      minWidth: 50,
      width: 90,
      filter: NumberColumnFilter,
    },
    {
      colId: 'id',
      field: 'id',
      headerName: translateService.instant('pages.logs.grid.col-def.id'),
      headerTooltip: translateService.instant('pages.logs.grid.col-def.id'),
      minWidth: 50,
      width: 90,
      filter: NumberColumnFilter,
    },
  ];
}
