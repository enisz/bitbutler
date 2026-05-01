import { formatBytes, formatBytesPerSec } from './format-bytes';

describe('formatBytes', () => {
  it('returns "0 B" for 0', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('returns "0 B" for null', () => {
    expect(formatBytes(null)).toBe('0 B');
  });

  it('returns "0 B" for undefined', () => {
    expect(formatBytes(undefined)).toBe('0 B');
  });

  it('returns "0 B" for empty string', () => {
    expect(formatBytes('')).toBe('0 B');
  });

  it('formats 1024 as "1 KB"', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats 1048576 as "1 MB"', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('formats 1073741824 as "1 GB"', () => {
    expect(formatBytes(1073741824)).toBe('1 GB');
  });

  it('accepts a bigint value', () => {
    expect(formatBytes(1024n)).toBe('1 KB');
  });

  it('accepts a numeric string', () => {
    expect(formatBytes('2048')).toBe('2 KB');
  });

  it('returns "0 B" for a non-numeric string', () => {
    expect(formatBytes('not-a-number')).toBe('0 B');
  });

  it('clamps negative values to "0 B"', () => {
    expect(formatBytes(-100)).toBe('0 B');
  });
});

describe('formatBytesPerSec', () => {
  it('appends "/s" to the formatted bytes', () => {
    expect(formatBytesPerSec(1024)).toBe('1 KB/s');
  });

  it('returns "0 B/s" for 0', () => {
    expect(formatBytesPerSec(0)).toBe('0 B/s');
  });

  it('returns "0 B/s" for null', () => {
    expect(formatBytesPerSec(null)).toBe('0 B/s');
  });
});
