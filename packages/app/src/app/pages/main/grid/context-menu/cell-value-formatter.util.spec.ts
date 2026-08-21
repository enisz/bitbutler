import type { CellContextMenuEvent } from 'ag-grid-community';
import { getFormattedCellValue } from './cell-value-formatter.util';

function makeEvent(overrides: Partial<CellContextMenuEvent> = {}): CellContextMenuEvent {
  return {
    value: 'raw-value',
    data: {},
    node: {},
    column: {},
    colDef: {},
    api: {},
    context: {},
    ...overrides,
  } as CellContextMenuEvent;
}

describe('getFormattedCellValue', () => {
  it('returns undefined when the raw value is null', () => {
    expect(getFormattedCellValue(makeEvent({ value: null }))).toBeUndefined();
  });

  it('returns undefined when the raw value is undefined', () => {
    expect(getFormattedCellValue(makeEvent({ value: undefined }))).toBeUndefined();
  });

  it('returns the raw value as a string when the column has no valueFormatter', () => {
    expect(getFormattedCellValue(makeEvent({ value: 42 }))).toBe('42');
  });

  it('returns the formatted value when the column has a valueFormatter', () => {
    const event = makeEvent({
      value: 0.5,
      colDef: { valueFormatter: (p: any) => `${p.value * 100}%` },
    });
    expect(getFormattedCellValue(event)).toBe('50%');
  });

  it('passes the event data through to the valueFormatter', () => {
    const valueFormatter = vi.fn().mockReturnValue('formatted');
    const event = makeEvent({
      value: 'x',
      data: { name: 'My Torrent' },
      colDef: { valueFormatter },
    });

    getFormattedCellValue(event);

    expect(valueFormatter).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'x', data: { name: 'My Torrent' } }),
    );
  });

  it('falls back to the raw value when the formatter returns null', () => {
    const event = makeEvent({ value: 'x', colDef: { valueFormatter: () => null as any } });
    expect(getFormattedCellValue(event)).toBe('x');
  });
});
