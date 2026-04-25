import { TestBed } from '@angular/core/testing';
import { RatioLimitPipe } from './ratio-limit-pipe';

describe('RatioLimitPipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({ providers: [RatioLimitPipe] });
    const pipe = TestBed.inject(RatioLimitPipe);
    expect(pipe).toBeTruthy();
  });
});
