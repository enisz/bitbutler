import type { LogEntry } from '@bitbutler/shared';
import type { DatepickerRangeFilterParams } from '../../../components/column-filters/datepicker-range-filter/datepicker-range-filter';
import type { SetColumnFilterParams } from '../../../components/column-filters/set-column-filter/set-column-filter';
import { getLogGridColDefs, getLogRowClassRules, maxLogDate, minLogDate } from './logs-grid.lib';

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 1,
    timestamp: 1700000000,
    process: 'main',
    level: 'info',
    message: 'hello',
    context: null,
    filename: null,
    line: null,
    ...overrides,
  };
}

describe('minLogDate / maxLogDate', () => {
  it('returns null for an empty list', () => {
    expect(minLogDate([])).toBeNull();
    expect(maxLogDate([])).toBeNull();
  });

  it('returns the earliest and latest timestamp as Date objects', () => {
    const logs = [
      makeLog({ timestamp: 1700000000 }),
      makeLog({ timestamp: 1700003600 }),
      makeLog({ timestamp: 1699996400 }),
    ];
    expect(minLogDate(logs)).toEqual(new Date(1699996400 * 1000));
    expect(maxLogDate(logs)).toEqual(new Date(1700003600 * 1000));
  });
});

describe('getLogRowClassRules', () => {
  it('matches a row only when color coding is enabled and the level matches', () => {
    const rules = getLogRowClassRules(() => true);
    const errorRule = rules['text-danger-emphasis bg-danger-subtle'] as (params: any) => boolean;
    const infoRule = rules['text-info-emphasis bg-info-subtle'] as (params: any) => boolean;

    expect(errorRule({ data: makeLog({ level: 'error' }) } as any)).toBe(true);
    expect(errorRule({ data: makeLog({ level: 'info' }) } as any)).toBe(false);
    expect(infoRule({ data: makeLog({ level: 'info' }) } as any)).toBe(true);
  });

  it('never matches when color coding is disabled', () => {
    const rules = getLogRowClassRules(() => false);
    const errorRule = rules['text-danger-emphasis bg-danger-subtle'] as (params: any) => boolean;

    expect(errorRule({ data: makeLog({ level: 'error' }) } as any)).toBe(false);
  });

  it('provides a rule for every log level', () => {
    const rules = getLogRowClassRules(() => true);
    expect(Object.keys(rules)).toEqual([
      'text-secondary-emphasis bg-secondary-subtle',
      'text-info-emphasis bg-info-subtle',
      'text-warning-emphasis bg-warning-subtle',
      'text-danger-emphasis bg-danger-subtle',
    ]);
  });
});

describe('getLogGridColDefs', () => {
  const translateService = { instant: (k: string) => k } as any;
  const uiFormatService = { localTimestamp: () => '' } as any;

  it('wires the process and level columns to SetColumnFilter with counts derived from the given logs', () => {
    const logs = [
      makeLog({ process: 'main' }),
      makeLog({ process: 'renderer' }),
      makeLog({ process: 'main' }),
    ];
    const defs = getLogGridColDefs(uiFormatService, translateService, () => logs);
    const processDef = defs.find((d) => d.colId === 'process')!;
    const params = processDef.filterParams as SetColumnFilterParams;

    expect(processDef.filter).toBeDefined();
    expect(params.getItems()).toEqual([
      { key: 'main', label: 'main', count: 2 },
      { key: 'renderer', label: 'renderer', count: 1 },
    ]);
  });

  it('wires the timestamp column to DatepickerRangeFilter with min/max derived from the given logs', () => {
    const logs = [makeLog({ timestamp: 1700000000 }), makeLog({ timestamp: 1700003600 })];
    const defs = getLogGridColDefs(uiFormatService, translateService, () => logs);
    const timestampDef = defs.find((d) => d.colId === 'timestamp')!;
    const params = timestampDef.filterParams as DatepickerRangeFilterParams;

    expect(timestampDef.sort).toBe('desc');
    expect(params.getMinDate!()).toEqual(new Date(1700000000 * 1000));
    expect(params.getMaxDate!()).toEqual(new Date(1700003600 * 1000));
  });

  it('includes a column definition for every LogEntry field', () => {
    const defs = getLogGridColDefs(uiFormatService, translateService, () => []);
    const colIds = defs.map((d) => d.colId);
    expect(colIds.sort()).toEqual(
      ['id', 'timestamp', 'process', 'level', 'message', 'context', 'filename', 'line'].sort(),
    );
  });

  it('shows every column by default', () => {
    const defs = getLogGridColDefs(uiFormatService, translateService, () => []);
    expect(defs.every((d) => !d.hide)).toBe(true);
  });
});
