import { AG_GRID_LOCALE_EN, AG_GRID_LOCALE_HU } from '@ag-grid-community/locale';
import { TranslateService } from '@ngx-translate/core';
import {
  CellContextMenuEvent,
  CellValueChangedEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  RowClassParams,
  RowDoubleClickedEvent,
  SelectionChangedEvent,
  TooltipValueGetterFunc,
  ValueFormatterParams,
} from 'ag-grid-community';
import { GRID_SHARED_OPTIONS } from '../../../app.const';
import { BooleanColumnFilter } from '../../../components/column-filters/boolean-column-filter/boolean-column-filter';
import { DatepickerRangeFilter } from '../../../components/column-filters/datepicker-range-filter/datepicker-range-filter';
import { NumberColumnFilter } from '../../../components/column-filters/number-column-filter/number-column-filter';
import {
  SetColumnFilter,
  SetColumnFilterParams,
} from '../../../components/column-filters/set-column-filter/set-column-filter';
import { SizeColumnFilter } from '../../../components/column-filters/size-column-filter/size-column-filter';
import { TextColumnFilter } from '../../../components/column-filters/text-column-filter/text-column-filter';
import { Torrent, TorrentState } from '../../../models/torrent.model';
import { ContextMenuService } from '../../../services/context-menu.service';
import { FilterService, GRID_FILTER_INITIAL } from '../../../services/filter.service';
import { GridStateService } from '../../../services/grid-state.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { UiFormatService } from '../../../services/ui-format.service';
import { GridContextMenuService } from './context-menu/grid-context-menu.service';
import { LoadingOverlay } from './overlays/loading-overlay/loading-overlay';
import { NoRowOverlay } from './overlays/no-row-overlay/no-row-overlay';
import { CodeCellRenderer } from './renderers/code-cell-renderer/code-cell-renderer';
import { ProgressCellRenderer } from './renderers/progress-cell-renderer/progress-cell-renderer';

const tooltipFormattedValue: TooltipValueGetterFunc<Torrent, any> = (params) =>
  params.valueFormatted ?? '';

export function getGridColDefs(
  uiFormatService: UiFormatService,
  translateService: TranslateService,
): ColDef<Torrent>[] {
  return [
    {
      colId: 'name',
      field: 'name',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.name'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.name'),
      minWidth: 50,
      width: 590,
      tooltipField: 'name',
      filter: TextColumnFilter,
    },
    {
      colId: 'hash',
      field: 'hash',
      tooltipField: 'hash',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.hash'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.hash'),
      minWidth: 50,
      width: 340,
      cellRenderer: CodeCellRenderer,
      filter: TextColumnFilter,
      hide: true,
    },
    {
      colId: 'progress',
      field: 'progress',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.progress'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.progress'),
      width: 135,
      cellRenderer: ProgressCellRenderer,
    },
    {
      colId: 'progress_percentage',
      field: 'progress',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.progress_percentage'),
      headerTooltip: translateService.instant(
        'pages.main.grid.grid-lib.col-def.progress_percentage',
      ),
      minWidth: 50,
      width: 110,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
      valueFormatter: (params: ValueFormatterParams<Torrent, number>): string =>
        params.value != null ? (params.value * 100).toFixed(1) + '%' : '',
    },
    {
      colId: 'progress_raw',
      field: 'progress',
      tooltipField: 'progress',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.progress_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.progress_raw'),
      minWidth: 50,
      width: 100,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'size',
      field: 'size',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.size'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.size'),
      minWidth: 50,
      width: 135,
      valueFormatter: uiFormatService.fileSize,
      cellClass: 'tabular-nums',
      filter: SizeColumnFilter,
    },
    {
      colId: 'size_raw',
      field: 'size',
      tooltipField: 'size',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.size_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.size_raw'),
      minWidth: 50,
      width: 135,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'total_size',
      field: 'total_size',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.total_size'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.total_size'),
      minWidth: 50,
      width: 135,
      valueFormatter: uiFormatService.fileSize,
      cellClass: 'tabular-nums',
      filter: SizeColumnFilter,
      hide: true,
    },
    {
      colId: 'total_size_raw',
      field: 'total_size',
      tooltipField: 'total_size',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.total_size_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.total_size_raw'),
      minWidth: 50,
      width: 135,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'completed',
      field: 'completed',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.completed'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.completed'),
      minWidth: 50,
      width: 135,
      valueFormatter: uiFormatService.fileSize,
      cellClass: 'tabular-nums',
      filter: SizeColumnFilter,
      hide: true,
    },
    {
      colId: 'completed_raw',
      field: 'completed',
      tooltipField: 'completed',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.completed_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.completed_raw'),
      minWidth: 50,
      width: 135,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'amount_left',
      field: 'amount_left',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.amount_left'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.amount_left'),
      minWidth: 50,
      width: 130,
      valueFormatter: uiFormatService.fileSize,
      cellClass: 'tabular-nums',
      filter: SizeColumnFilter,
      hide: true,
    },
    {
      colId: 'amount_left_raw',
      field: 'amount_left',
      tooltipField: 'amount_left',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.amount_left_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.amount_left_raw'),
      minWidth: 50,
      width: 130,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'downloaded',
      field: 'downloaded',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.downloaded'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.downloaded'),
      minWidth: 50,
      width: 150,
      valueFormatter: uiFormatService.fileSize,
      cellClass: 'tabular-nums',
      filter: SizeColumnFilter,
    },
    {
      colId: 'downloaded_raw',
      field: 'downloaded',
      tooltipField: 'downloaded',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.downloaded_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.downloaded_raw'),
      minWidth: 50,
      width: 150,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'downloaded_session',
      field: 'downloaded_session',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.downloaded_session'),
      headerTooltip: translateService.instant(
        'pages.main.grid.grid-lib.col-def.downloaded_session',
      ),
      minWidth: 50,
      width: 195,
      valueFormatter: uiFormatService.fileSize,
      cellClass: 'tabular-nums',
      filter: SizeColumnFilter,
      hide: true,
    },
    {
      colId: 'downloaded_session_raw',
      field: 'downloaded_session',
      tooltipField: 'downloaded_session',
      headerName: translateService.instant(
        'pages.main.grid.grid-lib.col-def.downloaded_session_raw',
      ),
      headerTooltip: translateService.instant(
        'pages.main.grid.grid-lib.col-def.downloaded_session_raw',
      ),
      minWidth: 50,
      width: 195,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'uploaded',
      field: 'uploaded',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.uploaded'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.uploaded'),
      minWidth: 50,
      width: 150,
      valueFormatter: uiFormatService.fileSize,
      cellClass: 'tabular-nums',
      filter: SizeColumnFilter,
    },
    {
      colId: 'uploaded_raw',
      field: 'uploaded',
      tooltipField: 'uploaded',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.uploaded_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.uploaded_raw'),
      minWidth: 50,
      width: 150,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'uploaded_session',
      field: 'uploaded_session',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.uploaded_session'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.uploaded_session'),
      minWidth: 50,
      width: 175,
      valueFormatter: uiFormatService.fileSize,
      cellClass: 'tabular-nums',
      filter: SizeColumnFilter,
      hide: true,
    },
    {
      colId: 'uploaded_session_raw',
      field: 'uploaded_session',
      tooltipField: 'uploaded_session',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.uploaded_session_raw'),
      headerTooltip: translateService.instant(
        'pages.main.grid.grid-lib.col-def.uploaded_session_raw',
      ),
      minWidth: 50,
      width: 175,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'dlspeed',
      field: 'dlspeed',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.dlspeed'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.dlspeed'),
      minWidth: 50,
      width: 165,
      valueFormatter: uiFormatService.fileSizePerSecond,
      cellClass: 'tabular-nums',
      filter: SizeColumnFilter,
    },
    {
      colId: 'dlspeed_raw',
      field: 'dlspeed',
      tooltipField: 'dlspeed',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.dlspeed_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.dlspeed_raw'),
      minWidth: 50,
      width: 165,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'upspeed',
      field: 'upspeed',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.upspeed'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.upspeed'),
      minWidth: 50,
      width: 165,
      valueFormatter: uiFormatService.fileSizePerSecond,
      cellClass: 'tabular-nums',
      filter: SizeColumnFilter,
    },
    {
      colId: 'upspeed_raw',
      field: 'upspeed',
      tooltipField: 'upspeed',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.upspeed_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.upspeed_raw'),
      minWidth: 50,
      width: 165,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'ratio',
      field: 'ratio',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.ratio'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.ratio'),
      minWidth: 50,
      width: 105,
      valueFormatter: uiFormatService.ratio,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
    },
    {
      colId: 'eta',
      field: 'eta',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.eta'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.eta'),
      minWidth: 50,
      width: 220,
      valueFormatter: (params: ValueFormatterParams<Torrent, any>): string =>
        params.data?.state === 'uploading' ||
        params.data?.state === 'pausedUP' ||
        params.data?.state === 'stoppedUP' ||
        params.data?.state === 'queuedUP' ||
        params.data?.state === 'stalledUP' ||
        params.data?.state === 'checkingUP' ||
        params.data?.state === 'forcedUP'
          ? ''
          : uiFormatService.durationSeconds(params, 2),
    },
    {
      colId: 'eta_raw',
      field: 'eta',
      tooltipField: 'eta',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.eta_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.eta_raw'),
      minWidth: 50,
      width: 100,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'added_on',
      field: 'added_on',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.added_on'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.added_on'),
      minWidth: 50,
      width: 170,
      valueFormatter: uiFormatService.localTimestamp,
      filter: DatepickerRangeFilter,
      sort: 'desc',
      cellClass: 'tabular-nums',
    },
    {
      colId: 'state',
      field: 'state',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.state'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.state'),
      minWidth: 50,
      width: 140,
      tooltipField: 'state',
      filter: SetColumnFilter,
      filterParams: { source: 'state' } satisfies Partial<SetColumnFilterParams>,
      hide: true,
    },
    {
      colId: 'state_hr',
      field: 'state',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.state_hr'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.state_hr'),
      minWidth: 50,
      width: 220,
      filter: SetColumnFilter,
      filterParams: { source: 'state' } satisfies Partial<SetColumnFilterParams>,
      hide: true,
      valueFormatter: (params: ValueFormatterParams<Torrent, TorrentState>): string =>
        params.value ? translateService.instant('torrent.state.' + params.value) : '',
      tooltipValueGetter: tooltipFormattedValue,
    },
    {
      colId: 'category',
      field: 'category',
      tooltipField: 'category',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.category'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.category'),
      minWidth: 50,
      width: 180,
      filter: SetColumnFilter,
      filterParams: { source: 'category' } satisfies Partial<SetColumnFilterParams>,
      hide: true,
    },
    {
      colId: 'tags',
      field: 'tags',
      tooltipField: 'tags',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.tags'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.tags'),
      minWidth: 50,
      width: 180,
      filter: SetColumnFilter,
      filterParams: { source: 'tags' } satisfies Partial<SetColumnFilterParams>,
      hide: true,
    },
    {
      colId: 'tracker',
      field: 'tracker',
      tooltipField: 'tracker',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.tracker'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.tracker'),
      minWidth: 50,
      width: 590,
      filter: TextColumnFilter,
      hide: true,
    },
    {
      colId: 'trackers_count',
      field: 'trackers_count',
      tooltipField: 'trackers_count',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.trackers_count'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.trackers_count'),
      minWidth: 50,
      width: 115,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'dl_limit',
      field: 'dl_limit',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.dl_limit'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.dl_limit'),
      minWidth: 50,
      width: 150,
      valueFormatter: uiFormatService.fileSizePerSecond,
      cellClass: 'tabular-nums',
      filter: SizeColumnFilter,
      hide: true,
    },
    {
      colId: 'dl_limit_raw',
      field: 'dl_limit',
      tooltipField: 'dl_limit',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.dl_limit_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.dl_limit_raw'),
      minWidth: 50,
      width: 150,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'up_limit',
      field: 'up_limit',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.up_limit'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.up_limit'),
      minWidth: 50,
      width: 130,
      valueFormatter: uiFormatService.fileSizePerSecond,
      cellClass: 'tabular-nums',
      filter: SizeColumnFilter,
      hide: true,
    },
    {
      colId: 'up_limit_raw',
      field: 'up_limit',
      tooltipField: 'up_limit',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.up_limit_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.up_limit_raw'),
      minWidth: 50,
      width: 130,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'max_ratio',
      field: 'max_ratio',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.max_ratio'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.max_ratio'),
      minWidth: 50,
      width: 125,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.ratioLimit,
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'ratio_limit',
      field: 'ratio_limit',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.ratio_limit'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.ratio_limit'),
      minWidth: 50,
      width: 135,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.ratioLimit,
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'seeding_time',
      field: 'seeding_time',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.seeding_time'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.seeding_time'),
      minWidth: 50,
      width: 250,
      valueFormatter: (params: ValueFormatterParams<Torrent, number>) =>
        uiFormatService.durationSeconds(params, 2),
      hide: true,
    },
    {
      colId: 'seeding_time_raw',
      field: 'seeding_time',
      tooltipField: 'seeding_time',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.seeding_time_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.seeding_time_raw'),
      minWidth: 50,
      width: 150,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'seeding_time_limit',
      field: 'seeding_time_limit',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.seeding_time_limit'),
      headerTooltip: translateService.instant(
        'pages.main.grid.grid-lib.col-def.seeding_time_limit',
      ),
      minWidth: 50,
      width: 155,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.timeLimit,
      hide: true,
    },
    {
      colId: 'seeding_time_limit_raw',
      field: 'seeding_time_limit',
      tooltipField: 'seeding_time_limit',
      headerName: translateService.instant(
        'pages.main.grid.grid-lib.col-def.seeding_time_limit_raw',
      ),
      headerTooltip: translateService.instant(
        'pages.main.grid.grid-lib.col-def.seeding_time_limit_raw',
      ),
      minWidth: 50,
      width: 155,
      cellClass: 'tabular-nums',
      filter: 'agNumberColumnFilter',
      hide: true,
    },
    {
      colId: 'time_active',
      field: 'time_active',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.time_active'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.time_active'),
      minWidth: 50,
      width: 200,
      valueFormatter: (params: ValueFormatterParams<Torrent, number>) =>
        uiFormatService.durationSeconds(params, 2),
      hide: true,
    },
    {
      colId: 'time_active_raw',
      field: 'time_active',
      tooltipField: 'time_active',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.time_active_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.time_active_raw'),
      minWidth: 50,
      width: 150,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'last_activity',
      field: 'last_activity',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.last_activity'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.last_activity'),
      minWidth: 50,
      width: 185,
      valueFormatter: uiFormatService.localTimestamp,
      filter: DatepickerRangeFilter,
      cellClass: 'tabular-nums',
      hide: true,
    },
    {
      colId: 'seen_complete',
      field: 'seen_complete',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.seen_complete'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.seen_complete'),
      minWidth: 50,
      width: 185,
      valueFormatter: uiFormatService.localTimestamp,
      filter: DatepickerRangeFilter,
      cellClass: 'tabular-nums',
      hide: true,
    },
    {
      colId: 'completion_on',
      field: 'completion_on',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.completion_on'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.completion_on'),
      minWidth: 50,
      width: 165,
      valueFormatter: uiFormatService.localTimestamp,
      filter: DatepickerRangeFilter,
      cellClass: 'tabular-nums',
      hide: true,
    },
    {
      colId: 'num_seeds',
      field: 'num_seeds',
      tooltipField: 'num_seeds',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.num_seeds'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.num_seeds'),
      minWidth: 50,
      width: 100,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'num_leechs',
      field: 'num_leechs',
      tooltipField: 'num_leechs',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.num_leechs'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.num_leechs'),
      minWidth: 50,
      width: 120,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'num_complete',
      field: 'num_complete',
      tooltipField: 'num_complete',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.num_complete'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.num_complete'),
      minWidth: 50,
      width: 125,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'num_incomplete',
      field: 'num_incomplete',
      tooltipField: 'num_incomplete',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.num_incomplete'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.num_incomplete'),
      minWidth: 50,
      width: 140,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'priority',
      field: 'priority',
      tooltipField: 'priority',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.priority'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.priority'),
      minWidth: 50,
      width: 130,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'auto_tmm',
      field: 'auto_tmm',
      tooltipField: 'auto_tmm',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.auto_tmm'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.auto_tmm'),
      minWidth: 50,
      width: 150,
      cellRenderer: 'agCheckboxCellRenderer',
      filter: BooleanColumnFilter,
      editable: false,
      hide: true,
    },
    {
      colId: 'seq_dl',
      field: 'seq_dl',
      tooltipField: 'seq_dl',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.seq_dl'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.seq_dl'),
      minWidth: 50,
      width: 225,
      cellRenderer: 'agCheckboxCellRenderer',
      filter: BooleanColumnFilter,
      editable: false,
      hide: true,
    },
    {
      colId: 'force_start',
      field: 'force_start',
      tooltipField: 'force_start',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.force_start'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.force_start'),
      minWidth: 50,
      width: 155,
      cellRenderer: 'agCheckboxCellRenderer',
      filter: BooleanColumnFilter,
      editable: false,
      hide: true,
    },
    {
      colId: 'super_seeding',
      field: 'super_seeding',
      tooltipField: 'super_seeding',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.super_seeding'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.super_seeding'),
      minWidth: 50,
      width: 180,
      cellRenderer: 'agCheckboxCellRenderer',
      filter: BooleanColumnFilter,
      editable: false,
      hide: true,
    },
    {
      colId: 'f_l_piece_prio',
      field: 'f_l_piece_prio',
      tooltipField: 'f_l_piece_prio',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.f_l_piece_prio'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.f_l_piece_prio'),
      minWidth: 50,
      width: 255,
      cellRenderer: 'agCheckboxCellRenderer',
      filter: BooleanColumnFilter,
      editable: false,
      hide: true,
    },
    {
      colId: 'availability',
      field: 'availability',
      tooltipField: 'availability',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.availability'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.availability'),
      width: 200,
      hide: true,
    },
    {
      colId: 'max_seeding_time',
      field: 'max_seeding_time',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.max_seeding_time'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.max_seeding_time'),
      minWidth: 50,
      width: 230,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.timeLimit,
      hide: true,
    },
    {
      colId: 'max_seeding_time_raw',
      field: 'max_seeding_time',
      tooltipField: 'max_seeding_time',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.max_seeding_time_raw'),
      headerTooltip: translateService.instant(
        'pages.main.grid.grid-lib.col-def.max_seeding_time_raw',
      ),
      minWidth: 50,
      width: 150,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'max_inactive_seeding_time',
      field: 'max_inactive_seeding_time',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant(
        'pages.main.grid.grid-lib.col-def.max_inactive_seeding_time',
      ),
      headerTooltip: translateService.instant(
        'pages.main.grid.grid-lib.col-def.max_inactive_seeding_time',
      ),
      minWidth: 50,
      width: 285,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.timeLimit,
      hide: true,
    },
    {
      colId: 'max_inactive_seeding_time_raw',
      field: 'max_inactive_seeding_time',
      tooltipField: 'max_inactive_seeding_time',
      headerName: translateService.instant(
        'pages.main.grid.grid-lib.col-def.max_inactive_seeding_time_raw',
      ),
      headerTooltip: translateService.instant(
        'pages.main.grid.grid-lib.col-def.max_inactive_seeding_time_raw',
      ),
      minWidth: 50,
      width: 180,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'inactive_seeding_time_limit',
      field: 'inactive_seeding_time_limit',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant(
        'pages.main.grid.grid-lib.col-def.inactive_seeding_time_limit',
      ),
      headerTooltip: translateService.instant(
        'pages.main.grid.grid-lib.col-def.inactive_seeding_time_limit',
      ),
      minWidth: 50,
      width: 255,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.timeLimit,
      hide: true,
    },
    {
      colId: 'inactive_seeding_time_limit_raw',
      field: 'inactive_seeding_time_limit',
      tooltipField: 'inactive_seeding_time_limit',
      headerName: translateService.instant(
        'pages.main.grid.grid-lib.col-def.inactive_seeding_time_limit_raw',
      ),
      headerTooltip: translateService.instant(
        'pages.main.grid.grid-lib.col-def.inactive_seeding_time_limit_raw',
      ),
      minWidth: 50,
      width: 180,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'content_path',
      field: 'content_path',
      tooltipField: 'content_path',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.content_path'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.content_path'),
      minWidth: 50,
      width: 1070,
      filter: TextColumnFilter,
      hide: true,
    },
    {
      colId: 'save_path',
      field: 'save_path',
      tooltipField: 'save_path',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.save_path'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.save_path'),
      minWidth: 50,
      width: 365,
      filter: TextColumnFilter,
    },
    {
      colId: 'download_path',
      field: 'download_path',
      tooltipField: 'download_path',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.download_path'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.download_path'),
      minWidth: 50,
      width: 360,
      filter: TextColumnFilter,
      hide: true,
    },
    {
      colId: 'magnet_uri',
      field: 'magnet_uri',
      tooltipField: 'magnet_uri',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.magnet_uri'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.magnet_uri'),
      minWidth: 50,
      width: 1010,
      filter: TextColumnFilter,
      hide: true,
    },
    {
      colId: 'infohash_v1',
      field: 'infohash_v1',
      tooltipField: 'infohash_v1',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.infohash_v1'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.infohash_v1'),
      minWidth: 50,
      width: 340,
      cellRenderer: CodeCellRenderer,
      filter: TextColumnFilter,
      hide: true,
    },
    {
      colId: 'infohash_v2',
      field: 'infohash_v2',
      tooltipField: 'infohash_v2',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.infohash_v2'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.infohash_v2'),
      minWidth: 50,
      width: 340,
      cellRenderer: CodeCellRenderer,
      filter: TextColumnFilter,
      hide: true,
    },
  ];
}

export function getGridOptions(
  contextMenuService: ContextMenuService,
  selectionStore: SelectionStoreService,
  filterService: FilterService,
  gridStateService: GridStateService,
  gridContextMenuService: GridContextMenuService,
  uiFormatService: UiFormatService,
  translateService: TranslateService,
  opts: {
    getHasLoadedInitialState: () => boolean;
    getIsRestoringGridState: () => boolean;
    setIsRestoringGridState: (v: boolean) => void;
    setHasLoadedInitialState: (v: boolean) => void;
    queueSave: () => void;
    updateInViewCount: () => void;
    getSelectionAnchorIndex: () => number | null;
    getSelectionLeadIndex: () => number | null;
    setSelectionAnchorIndex: (v: number | null) => void;
    setSelectionLeadIndex: (v: number | null) => void;
    getLatestFilters: () => typeof GRID_FILTER_INITIAL.external;
    getIsApplyingFilterFromService: () => boolean;
    setIsApplyingFilterFromService: (v: boolean) => void;
    normalizeTracker: (raw?: string | null) => string;
    getTrackers: (t: Torrent) => string[];
    handleCellRightClick: (e: CellContextMenuEvent<Torrent>) => void;
    handleRowDoubleClick: (e: RowDoubleClickedEvent<Torrent, any>) => void;
    onApiReady: (api: GridApi<Torrent>) => void;
    getIsProgrammaticSelection: () => boolean;
    applyDbSettings: () => Promise<void>;
    handleCellValueChanged: (e: CellValueChangedEvent<Torrent>) => void;
    onCellEditingStarted: () => void;
    onCellEditingStopped: () => void;
  },
): GridOptions<Torrent> {
  return {
    ...GRID_SHARED_OPTIONS,
    getLocaleText: ({ key, defaultValue }) => {
      const pack = translateService.currentLang === 'hu' ? AG_GRID_LOCALE_HU : AG_GRID_LOCALE_EN;
      return (pack as Record<string, string>)[key] ?? defaultValue;
    },
    pagination: true,
    animateRows: true,
    paginationPageSizeSelector: [50, 100, 500, 1000],
    paginationPageSize: 50,
    gridId: 'torrent-list',
    columnDefs: getGridColDefs(uiFormatService, translateService),
    getRowId: (params: GetRowIdParams<Torrent, any>) => params.data.hash,
    rowClassRules: {
      'text-secondary bg-secondary-subtle bb-row-paused': (
        params: RowClassParams<Torrent, any>,
      ): boolean =>
        params.data?.state === 'pausedDL' ||
        params.data?.state === 'pausedUP' ||
        params.data?.state === 'stoppedDL' ||
        params.data?.state === 'stoppedUP',

      'text-danger bg-danger-subtle': (params: RowClassParams<Torrent, any>): boolean =>
        params.data?.state === 'error',
    },
    rowSelection: {
      mode: 'multiRow',
      checkboxes: false,
      headerCheckbox: false,
      enableClickSelection: true,
    },
    overlayComponentSelector: (params: IOverlayParams<Torrent>) => {
      switch (params.overlayType) {
        case 'loading':
          return {
            component: LoadingOverlay,
            params: {
              title: translateService.instant(
                'pages.main.grid.grid-lib.grid-options.overlay.loading.title',
              ),
              message: translateService.instant(
                'pages.main.grid.grid-lib.grid-options.overlay.loading.message',
              ),
            },
          };

        case 'noRows':
          return {
            component: NoRowOverlay,
            params: {
              message: translateService.instant(
                'pages.main.grid.grid-lib.grid-options.overlay.no-rows.message',
              ),
            },
          };

        case 'noMatchingRows':
          return {
            component: NoRowOverlay,
            params: {
              message: translateService.instant(
                'pages.main.grid.grid-lib.grid-options.overlay.no-matching-rows.message',
              ),
            },
          };

        default:
          return undefined;
      }
    },

    onGridReady: (e: GridReadyEvent<Torrent>) => {
      opts.onApiReady(e.api);

      void (async () => {
        opts.setIsRestoringGridState(true);
        try {
          await gridStateService.restore(e.api);
          await opts.applyDbSettings();

          filterService.setColumnModel(e.api.getFilterModel());
          e.api.onFilterChanged();

          opts.updateInViewCount();
        } finally {
          setTimeout(() => {
            opts.setIsRestoringGridState(false);
            opts.setHasLoadedInitialState(true);
          }, 0);
        }
      })();
    },

    onRowClicked: (e) => {
      const ev = e.event as MouseEvent | KeyboardEvent | undefined;
      const shift = !!ev?.shiftKey;
      const ctrl = !!(ev as MouseEvent)?.ctrlKey;
      const meta = !!(ev as MouseEvent)?.metaKey;

      if (shift) return;

      if (!ctrl && !meta) {
        opts.setSelectionAnchorIndex(e.rowIndex ?? null);
        opts.setSelectionLeadIndex(e.rowIndex ?? null);
      } else {
        opts.setSelectionLeadIndex(e.rowIndex ?? opts.getSelectionLeadIndex());
      }
    },

    onFilterChanged: (e) => {
      const isRestoring = opts.getIsRestoringGridState();
      const isApplying = opts.getIsApplyingFilterFromService();

      if (!isRestoring && !isApplying) {
        filterService.setColumnModel(e.api.getFilterModel());
        opts.queueSave();
      }

      opts.updateInViewCount();
    },

    onColumnResized: (e) => {
      if (e.finished) opts.queueSave();
    },
    onColumnMoved: opts.queueSave,
    onColumnPinned: opts.queueSave,
    onColumnVisible: opts.queueSave,
    onSortChanged: opts.queueSave,
    onRowDataUpdated: opts.updateInViewCount,
    onFirstDataRendered: opts.updateInViewCount,

    isExternalFilterPresent: () => {
      const f: any = opts.getLatestFilters();
      return (
        f.states?.size > 0 ||
        !!(f.search ?? '').trim() ||
        f.trackers?.size > 0 ||
        f.savePaths?.size > 0 ||
        f.categories?.size > 0 ||
        f.tags?.size > 0
      );
    },

    doesExternalFilterPass: (node) => {
      const f = opts.getLatestFilters();
      const row = node.data;
      if (!row) return true;

      if (f.states.size > 0) {
        if (!row.state) return false;
        if (!f.states.has(row.state)) return false;
      }

      if (f.trackers.size > 0) {
        const trackers = opts.getTrackers(row);
        if (trackers.length === 0) {
          if (!f.trackers.has(opts.normalizeTracker(null))) return false;
        } else {
          const found = trackers.some((tracker) => f.trackers.has(opts.normalizeTracker(tracker)));
          if (!found) return false;
        }
      }

      if (f.savePaths.size > 0) {
        const p = (row.save_path ?? '').trim() || '(none)';
        if (!f.savePaths.has(p)) return false;
      }

      if (f.categories.size > 0) {
        const cat = (row.category ?? '').trim();
        if (!f.categories.has(cat)) return false;
      }

      if (f.tags.size > 0) {
        const tags = (row.tags ?? '').split(',').map((t) => t.trim());
        if (!tags.some((t) => f.tags.has(t))) return false;
      }

      const q = (f.search ?? '').trim().toLowerCase();
      if (q) {
        const hay = `${row.name ?? ''} ${row.save_path ?? ''} ${row.tracker ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    },

    onCellContextMenu: (e: CellContextMenuEvent<Torrent>) => opts.handleCellRightClick(e),
    onRowDoubleClicked: (e: RowDoubleClickedEvent<Torrent, any>) => opts.handleRowDoubleClick(e),
    onCellValueChanged: (e: CellValueChangedEvent<Torrent, any>) => opts.handleCellValueChanged(e),
    onCellEditingStarted: () => opts.onCellEditingStarted(),
    onCellEditingStopped: () => opts.onCellEditingStopped(),
    onSelectionChanged: (ev: SelectionChangedEvent<Torrent>) => {
      if (opts.getIsProgrammaticSelection()) {
        return;
      }
      selectionStore.set(ev.api.getSelectedRows() ?? []);
    },

    onColumnHeaderContextMenu: (e: ColumnHeaderContextMenuEvent<Torrent, any>) => {
      if (!e.column) {
        return;
      }
      contextMenuService.open({
        items: gridContextMenuService.buildHeaderMenu(e, { enableFloatingFiltersToggle: false }),
        payload: {
          colId: e.column?.getId(),
          displayName: e.api.getDisplayNameForColumn(e.column as Column, 'header'),
        },
      });
    },
  };
}
