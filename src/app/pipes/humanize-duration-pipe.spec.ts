import { TestBed } from '@angular/core/testing';
import { HumanizeDurationPipe } from './humanize-duration-pipe';

describe('HumanizeDurationPipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({ providers: [HumanizeDurationPipe] });
    const pipe = TestBed.inject(HumanizeDurationPipe);
    expect(pipe).toBeTruthy();
  });
});
