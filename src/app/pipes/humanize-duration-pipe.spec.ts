import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { HumanizeDurationPipe } from './humanize-duration-pipe';

const translateMock = {
  getCurrentLang: () => 'en-US',
  getFallbackLang: () => 'en-US',
};

describe('HumanizeDurationPipe', () => {
  let pipe: HumanizeDurationPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HumanizeDurationPipe, { provide: TranslateService, useValue: translateMock }],
    });
    pipe = TestBed.inject(HumanizeDurationPipe);
  });

  it('creates an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('returns "" for null', () => {
    expect(pipe.transform(null as any)).toBe('');
  });

  it('returns "" for undefined', () => {
    expect(pipe.transform(undefined as any)).toBe('');
  });

  it('returns "" for NaN', () => {
    expect(pipe.transform(NaN)).toBe('');
  });

  it('returns a non-empty string for a valid millisecond duration', () => {
    const result = pipe.transform(90000); // 1 min 30 sec
    expect(result).toBeTruthy();
  });

  it('includes seconds for a sub-minute duration', () => {
    const result = pipe.transform(30000); // 30 seconds
    expect(result).toContain('30');
  });

  it('includes minutes for a minute-scale duration', () => {
    const result = pipe.transform(120000); // 2 minutes exactly
    expect(result).toContain('2');
  });

  it('precision=1 limits output to the largest unit only', () => {
    // 90 000 ms = 1 min 30 sec; with precision=1 the seconds field is zeroed
    const full = pipe.transform(90000, 'long', Infinity);
    const limited = pipe.transform(90000, 'long', 1);
    expect(limited).not.toBe(full);
  });

  it('accepts "short" style without throwing', () => {
    expect(() => pipe.transform(60000, 'short')).not.toThrow();
  });

  it('accepts "narrow" style without throwing', () => {
    expect(() => pipe.transform(60000, 'narrow')).not.toThrow();
  });
});
