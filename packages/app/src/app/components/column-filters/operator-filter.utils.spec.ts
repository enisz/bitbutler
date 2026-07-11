import {
  NUMBER_FILTER_OPERATORS,
  STRING_FILTER_OPERATORS,
  numberOperatorPasses,
  stringOperatorPasses,
} from './operator-filter.utils';

describe('stringOperatorPasses', () => {
  it('contains matches case-insensitively', () => {
    expect(stringOperatorPasses('contains', 'Ubuntu 24.04 ISO', 'ubuntu')).toBe(true);
    expect(stringOperatorPasses('contains', 'Ubuntu 24.04 ISO', 'fedora')).toBe(false);
  });

  it('notContains is the inverse of contains', () => {
    expect(stringOperatorPasses('notContains', 'Ubuntu 24.04 ISO', 'fedora')).toBe(true);
    expect(stringOperatorPasses('notContains', 'Ubuntu 24.04 ISO', 'ubuntu')).toBe(false);
  });

  it('equals requires an exact case-insensitive match', () => {
    expect(stringOperatorPasses('equals', 'Movies', 'movies')).toBe(true);
    expect(stringOperatorPasses('equals', 'Movies', 'movie')).toBe(false);
  });

  it('notEqual is the inverse of equals', () => {
    expect(stringOperatorPasses('notEqual', 'Movies', 'tv')).toBe(true);
    expect(stringOperatorPasses('notEqual', 'Movies', 'movies')).toBe(false);
  });

  it('startsWith and endsWith match prefixes and suffixes', () => {
    expect(stringOperatorPasses('startsWith', 'Ubuntu 24.04 ISO', 'ubuntu')).toBe(true);
    expect(stringOperatorPasses('startsWith', 'Ubuntu 24.04 ISO', 'iso')).toBe(false);
    expect(stringOperatorPasses('endsWith', 'Ubuntu 24.04 ISO', 'iso')).toBe(true);
    expect(stringOperatorPasses('endsWith', 'Ubuntu 24.04 ISO', 'ubuntu')).toBe(false);
  });

  it('blank matches null, undefined, and whitespace-only values, ignoring filterValue', () => {
    expect(stringOperatorPasses('blank', null, 'anything')).toBe(true);
    expect(stringOperatorPasses('blank', undefined, 'anything')).toBe(true);
    expect(stringOperatorPasses('blank', '   ', 'anything')).toBe(true);
    expect(stringOperatorPasses('blank', 'x', 'anything')).toBe(false);
  });

  it('notBlank is the inverse of blank, ignoring filterValue', () => {
    expect(stringOperatorPasses('notBlank', 'x', 'anything')).toBe(true);
    expect(stringOperatorPasses('notBlank', null, 'anything')).toBe(false);
  });

  it('exposes all 8 string operators in a stable order', () => {
    expect(STRING_FILTER_OPERATORS).toEqual([
      'contains',
      'notContains',
      'equals',
      'notEqual',
      'startsWith',
      'endsWith',
      'blank',
      'notBlank',
    ]);
  });
});

describe('numberOperatorPasses', () => {
  it('equals/notEqual compare against from', () => {
    expect(numberOperatorPasses('equals', 5, 5, null)).toBe(true);
    expect(numberOperatorPasses('equals', 5, 6, null)).toBe(false);
    expect(numberOperatorPasses('notEqual', 5, 6, null)).toBe(true);
    expect(numberOperatorPasses('notEqual', 5, 5, null)).toBe(false);
  });

  it('gt/gte/lt/lte compare against from', () => {
    expect(numberOperatorPasses('gt', 10, 5, null)).toBe(true);
    expect(numberOperatorPasses('gt', 5, 5, null)).toBe(false);
    expect(numberOperatorPasses('gte', 5, 5, null)).toBe(true);
    expect(numberOperatorPasses('lt', 3, 5, null)).toBe(true);
    expect(numberOperatorPasses('lt', 5, 5, null)).toBe(false);
    expect(numberOperatorPasses('lte', 5, 5, null)).toBe(true);
  });

  it('between is inclusive on both ends', () => {
    expect(numberOperatorPasses('between', 5, 5, 10)).toBe(true);
    expect(numberOperatorPasses('between', 10, 5, 10)).toBe(true);
    expect(numberOperatorPasses('between', 4, 5, 10)).toBe(false);
    expect(numberOperatorPasses('between', 11, 5, 10)).toBe(false);
  });

  it('blank/notBlank check cellValue only, ignoring from/to', () => {
    expect(numberOperatorPasses('blank', null, 5, 10)).toBe(true);
    expect(numberOperatorPasses('blank', 0, 5, 10)).toBe(false);
    expect(numberOperatorPasses('notBlank', 0, 5, 10)).toBe(true);
    expect(numberOperatorPasses('notBlank', null, 5, 10)).toBe(false);
  });

  it('a null cellValue fails every operator except blank', () => {
    for (const operator of NUMBER_FILTER_OPERATORS.filter((o) => o !== 'blank')) {
      expect(numberOperatorPasses(operator, null, 5, 10)).toBe(false);
    }
  });

  it('exposes all 9 number operators in a stable order', () => {
    expect(NUMBER_FILTER_OPERATORS).toEqual([
      'equals',
      'notEqual',
      'gt',
      'gte',
      'lt',
      'lte',
      'between',
      'blank',
      'notBlank',
    ]);
  });
});
