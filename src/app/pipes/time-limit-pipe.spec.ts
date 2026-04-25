import { TestBed } from '@angular/core/testing';
import { HumanizeDurationPipe } from './humanize-duration-pipe';
import { TimeLimitPipe } from './time-limit-pipe';

describe('TimeLimitPipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({ providers: [TimeLimitPipe, HumanizeDurationPipe] });
    const pipe = TestBed.inject(TimeLimitPipe);
    expect(pipe).toBeTruthy();
  });
});
