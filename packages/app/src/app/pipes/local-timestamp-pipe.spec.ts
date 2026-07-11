import { TestBed } from '@angular/core/testing';
import { LocalTimestampPipe } from './local-timestamp-pipe';

describe('LocalTimestampPipe', () => {
  let pipe: LocalTimestampPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LocalTimestampPipe] });
    pipe = TestBed.inject(LocalTimestampPipe);
  });

  it('creates an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('returns "" for 0', () => {
    expect(pipe.transform(0)).toBe('');
  });

  it('returns "" for undefined', () => {
    expect(pipe.transform(undefined)).toBe('');
  });

  it('returns "" for a negative timestamp', () => {
    expect(pipe.transform(-1)).toBe('');
  });

  it('returns "" for the string "0"', () => {
    expect(pipe.transform('0')).toBe('');
  });

  it('formats a valid unix timestamp to YYYY-MM-DD HH:mm', () => {
    const ts = 1700000000;
    const result = pipe.transform(ts);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('pads single-digit month, day, hour and minute with a leading zero', () => {
    const date = new Date(2024, 0, 5, 9, 7);
    const ts = Math.floor(date.getTime() / 1000);
    const result = pipe.transform(ts);
    expect(result).toBe('2024-01-05 09:07');
  });

  it('formats a numeric string timestamp the same as a number', () => {
    const ts = 1700000000;
    expect(pipe.transform(String(ts))).toBe(pipe.transform(ts));
  });

  it('formats an ISO datetime string', () => {
    const result = pipe.transform('2024-01-05T13:07:00');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});
