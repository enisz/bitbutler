import type { DatepickerRangeFilterParams } from '../../../components/column-filters/datepicker-range-filter/datepicker-range-filter';
import type { Torrent } from '../../../models/torrent.model';
import { getGridColDefs, maxTorrentDate, minTorrentDate } from './grid.lib';

describe('minTorrentDate / maxTorrentDate', () => {
  const torrent = (overrides: Partial<Torrent> = {}) => ({ ...overrides }) as Torrent;

  it('returns null when no torrent has a valid value for the field', () => {
    const torrents = [torrent({ completion_on: -1 }), torrent({ completion_on: 0 })];
    expect(minTorrentDate(torrents, 'completion_on')).toBeNull();
    expect(maxTorrentDate(torrents, 'completion_on')).toBeNull();
  });

  it('ignores qBittorrent "not applicable" sentinel values (<= 0) when finding min/max', () => {
    const torrents = [
      torrent({ added_on: 1700000000 }),
      torrent({ added_on: -1 }),
      torrent({ added_on: 1699996400 }),
    ];
    expect(minTorrentDate(torrents, 'added_on')).toEqual(new Date(1699996400 * 1000));
    expect(maxTorrentDate(torrents, 'added_on')).toEqual(new Date(1700000000 * 1000));
  });
});

describe('getGridColDefs', () => {
  const translateServiceStub = { instant: (key: string) => key } as any;
  const uiFormatServiceStub = {} as any;
  let torrentStoreServiceStub: any;

  function getColDefs() {
    return getGridColDefs(uiFormatServiceStub, translateServiceStub, torrentStoreServiceStub);
  }

  beforeEach(() => {
    torrentStoreServiceStub = { torrentsArray: () => [] };
  });

  it.each(['added_on', 'last_activity', 'seen_complete', 'completion_on'] as const)(
    'wires the %s column to DatepickerRangeFilter with min/max derived from the current torrents',
    (colId) => {
      torrentStoreServiceStub.torrentsArray = () => [
        { [colId]: 1700000000 } as unknown as Torrent,
        { [colId]: 1700003600 } as unknown as Torrent,
      ];
      const colDef = getColDefs().find((c) => c.colId === colId)!;
      const params = colDef.filterParams as DatepickerRangeFilterParams;

      expect(colDef.filter).toBeDefined();
      expect(params.getMinDate!()).toEqual(new Date(1700000000 * 1000));
      expect(params.getMaxDate!()).toEqual(new Date(1700003600 * 1000));
    },
  );

  it('always treats the progress column value as changed, so state-driven color updates are not skipped', () => {
    const progressColDef = getColDefs().find((c) => c.colId === 'progress');

    expect(progressColDef?.equals).toBeDefined();
    expect(progressColDef!.equals!(0.5, 0.5)).toBe(false);
  });

  describe('progress_percentage valueFormatter', () => {
    function format(value: number | null) {
      const colDef = getColDefs().find((c) => c.colId === 'progress_percentage');
      return (colDef!.valueFormatter as any)({ value } as any);
    }

    it('formats a partial progress to 1 decimal place', () => {
      expect(format(0.5)).toBe('50.0%');
    });

    it('drops the decimal at 100%', () => {
      expect(format(1)).toBe('100%');
    });

    it('rounds values that display as 100.0% down to "100%"', () => {
      expect(format(0.9996)).toBe('100%');
    });

    it('returns an empty string for null', () => {
      expect(format(null)).toBe('');
    });
  });

  describe.each(['progress', 'progress_compact'])('%s valueFormatter', (colId) => {
    function format(value: number | null) {
      const colDef = getColDefs().find((c) => c.colId === colId);
      return (colDef!.valueFormatter as any)({ value } as any);
    }

    it('formats a partial progress to 1 decimal place, so copy-cell-value copies a percentage', () => {
      expect(format(0.5)).toBe('50.0%');
    });

    it('returns an empty string for null', () => {
      expect(format(null)).toBe('');
    });
  });

  describe('status_dot valueFormatter', () => {
    it('translates the raw torrent state, so copy-cell-value copies a readable label', () => {
      const colDef = getColDefs().find((c) => c.colId === 'status_dot');
      const formatted = (colDef!.valueFormatter as any)({ value: 'downloading' } as any);
      expect(formatted).toBe('torrent.state.downloading');
    });

    it('returns an empty string when there is no state', () => {
      const colDef = getColDefs().find((c) => c.colId === 'status_dot');
      expect((colDef!.valueFormatter as any)({ value: undefined } as any)).toBe('');
    });
  });
});
