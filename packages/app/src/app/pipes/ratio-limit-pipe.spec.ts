import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { RatioLimitPipe } from './ratio-limit-pipe';

const translateMock = {
  instant: (key: string) => key,
};

describe('RatioLimitPipe', () => {
  let pipe: RatioLimitPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RatioLimitPipe, { provide: TranslateService, useValue: translateMock }],
    });
    pipe = TestBed.inject(RatioLimitPipe);
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

  it('formats a numeric ratio to 2 decimal places', () => {
    expect(pipe.transform(1.5)).toBe('1.50');
  });

  it('formats 0 to "0.00"', () => {
    expect(pipe.transform(0)).toBe('0.00');
  });

  it('rounds to 2 decimal places', () => {
    expect(pipe.transform(2.567)).toBe('2.57');
  });

  it('formats a whole number with two trailing zeros', () => {
    expect(pipe.transform(3)).toBe('3.00');
  });
});
