import { RatioPipe } from './ratio-pipe';

describe('RatioPipe', () => {
  let pipe: RatioPipe;

  beforeEach(() => {
    pipe = new RatioPipe();
  });

  it('creates an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('formats a number to 2 decimal places by default', () => {
    expect(pipe.transform(1.234)).toBe('1.23');
  });

  it('formats 0 to "0.00"', () => {
    expect(pipe.transform(0)).toBe('0.00');
  });

  it('formats a whole number with trailing zeros', () => {
    expect(pipe.transform(1)).toBe('1.00');
  });

  it('uses null coalescing so null-like values render as 0', () => {
    expect(pipe.transform(null as any)).toBe('0.00');
  });

  it('uses null coalescing so undefined renders as 0', () => {
    expect(pipe.transform(undefined as any)).toBe('0.00');
  });

  it('accepts a custom digit count', () => {
    expect(pipe.transform(1.23456, 4)).toBe('1.2346');
  });

  it('rounds to the specified precision', () => {
    expect(pipe.transform(2.555, 2)).toBe('2.56');
  });

  it('formats 0 digits', () => {
    expect(pipe.transform(1.7, 0)).toBe('2');
  });
});
