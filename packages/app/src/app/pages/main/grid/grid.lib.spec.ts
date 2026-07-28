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
});
