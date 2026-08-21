import type { CellContextMenuEvent, ValueFormatterParams } from 'ag-grid-community';

/**
 * Resolves the value a right-clicked cell's "copy cell value" action should copy - the
 * column's formatted display value (matching what the user sees) when a valueFormatter is
 * defined, falling back to the raw value otherwise. Returns undefined when there is no value,
 * so callers can disable the copy action instead of copying an empty string.
 */
export function getFormattedCellValue<TData = any, TValue = any>(
  e: CellContextMenuEvent<TData, TValue>,
): string | undefined {
  if (e.value == null) return undefined;

  const formatter = e.colDef.valueFormatter;
  if (typeof formatter !== 'function') return String(e.value);

  const params: ValueFormatterParams<TData, TValue> = {
    value: e.value,
    data: e.data as TData,
    node: e.node,
    colDef: e.colDef,
    column: e.column,
    api: e.api,
    context: e.context,
  };
  const formatted = formatter(params);
  return formatted != null ? String(formatted) : String(e.value);
}
