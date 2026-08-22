import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { HumanizeDurationPipe } from './humanize-duration-pipe';
import { TimeLimitPipe } from './time-limit-pipe';

const translateMock = {
  instant: (key: string) => key,
  getCurrentLang: () => 'en-US',
  getFallbackLang: () => 'en-US',
};

describe('TimeLimitPipe', () => {
  let pipe: TimeLimitPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TimeLimitPipe,
        HumanizeDurationPipe,
        { provide: TranslateService, useValue: translateMock },
      ],
    });
    pipe = TestBed.inject(TimeLimitPipe);
  });

  it('creates an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('returns the "global" translation key for -2', () => {
    expect(pipe.transform(-2)).toBe('general.limit.global');
  });

  it('returns the "no-limit" translation key for -1', () => {
    expect(pipe.transform(-1)).toBe('general.limit.no-limit');
  });

  it('returns the "no-limit" translation key for undefined', () => {
    expect(pipe.transform(undefined)).toBe('general.limit.no-limit');
  });

  it('returns the "no-limit" translation key for null', () => {
    expect(pipe.transform(null)).toBe('general.limit.no-limit');
  });

  it('converts minutes to a humanized duration string', () => {
    const result = pipe.transform(60);
    expect(result).toBeTruthy();
  });

  it('passes value in minutes (converted to ms) to HumanizeDurationPipe', () => {
    const result = pipe.transform(1);
    expect(result).toContain('1');
  });

  it('returns a non-empty string for a positive limit', () => {
    expect(pipe.transform(30)).toBeTruthy();
  });
});
