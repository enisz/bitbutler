import { getGridColDefs } from './grid.lib';

describe('getGridColDefs', () => {
  const translateServiceStub = { instant: (key: string) => key } as any;
  const uiFormatServiceStub = {} as any;
  const torrentStoreServiceStub = {} as any;

  function getColDefs() {
    return getGridColDefs(uiFormatServiceStub, translateServiceStub, torrentStoreServiceStub);
  }

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
