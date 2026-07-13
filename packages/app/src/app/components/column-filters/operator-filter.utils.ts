export type StringFilterOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEqual'
  | 'startsWith'
  | 'endsWith'
  | 'blank'
  | 'notBlank';

export type NumberFilterOperator =
  | 'equals'
  | 'notEqual'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'blank'
  | 'notBlank';

export const STRING_FILTER_OPERATORS: StringFilterOperator[] = [
  'contains',
  'notContains',
  'equals',
  'notEqual',
  'startsWith',
  'endsWith',
  'blank',
  'notBlank',
];

export const NUMBER_FILTER_OPERATORS: NumberFilterOperator[] = [
  'equals',
  'notEqual',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'blank',
  'notBlank',
];

export const STRING_OPERATOR_LABEL_KEYS: Record<StringFilterOperator, string> = {
  contains: 'components.column-filters.operator.contains',
  notContains: 'components.column-filters.operator.not-contains',
  equals: 'components.column-filters.operator.equals',
  notEqual: 'components.column-filters.operator.not-equal',
  startsWith: 'components.column-filters.operator.starts-with',
  endsWith: 'components.column-filters.operator.ends-with',
  blank: 'components.column-filters.operator.blank',
  notBlank: 'components.column-filters.operator.not-blank',
};

export const NUMBER_OPERATOR_LABEL_KEYS: Record<NumberFilterOperator, string> = {
  equals: 'components.column-filters.operator.equals',
  notEqual: 'components.column-filters.operator.not-equal',
  gt: 'components.column-filters.operator.gt',
  gte: 'components.column-filters.operator.gte',
  lt: 'components.column-filters.operator.lt',
  lte: 'components.column-filters.operator.lte',
  between: 'components.column-filters.operator.between',
  blank: 'components.column-filters.operator.blank',
  notBlank: 'components.column-filters.operator.not-blank',
};

function isBlankStringValue(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}

export function stringOperatorPasses(
  operator: StringFilterOperator,
  cellValue: string | null | undefined,
  filterValue: string,
): boolean {
  if (operator === 'blank') return isBlankStringValue(cellValue);
  if (operator === 'notBlank') return !isBlankStringValue(cellValue);

  const cell = (cellValue ?? '').toLowerCase();
  const value = (filterValue ?? '').toLowerCase();

  switch (operator) {
    case 'contains':
      return cell.includes(value);
    case 'notContains':
      return !cell.includes(value);
    case 'equals':
      return cell === value;
    case 'notEqual':
      return cell !== value;
    case 'startsWith':
      return cell.startsWith(value);
    case 'endsWith':
      return cell.endsWith(value);
    default:
      return false;
  }
}

export function numberOperatorPasses(
  operator: NumberFilterOperator,
  cellValue: number | null | undefined,
  from: number | null,
  to: number | null,
): boolean {
  if (operator === 'blank') return cellValue == null;
  if (operator === 'notBlank') return cellValue != null;
  if (cellValue == null) return false;

  switch (operator) {
    case 'equals':
      return from != null && cellValue === from;
    case 'notEqual':
      return from == null || cellValue !== from;
    case 'gt':
      return from != null && cellValue > from;
    case 'gte':
      return from != null && cellValue >= from;
    case 'lt':
      return from != null && cellValue < from;
    case 'lte':
      return from != null && cellValue <= from;
    case 'between':
      return from != null && to != null && cellValue >= from && cellValue <= to;
    default:
      return false;
  }
}
