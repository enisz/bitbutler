import { formatProgressPercent } from './format-progress-percent';

describe('formatProgressPercent', () => {
  it('formats a mid-range value to 1 decimal place', () => {
    expect(formatProgressPercent(50)).toBe('50.0%');
  });

  it('drops the decimal at 0%', () => {
    expect(formatProgressPercent(0)).toBe('0%');
  });

  it('drops the decimal at 100%', () => {
    expect(formatProgressPercent(100)).toBe('100%');
  });

  it('rounds values that display as 100.0% down to "100%"', () => {
    expect(formatProgressPercent(99.96)).toBe('100%');
  });

  it('rounds values that display as 0.0% up to "0%"', () => {
    expect(formatProgressPercent(0.04)).toBe('0%');
  });

  it('keeps a small non-zero value at 1 decimal place', () => {
    expect(formatProgressPercent(0.06)).toBe('0.1%');
  });

  it('clamps values above 100', () => {
    expect(formatProgressPercent(150)).toBe('100%');
  });

  it('clamps negative values', () => {
    expect(formatProgressPercent(-5)).toBe('0%');
  });
});
