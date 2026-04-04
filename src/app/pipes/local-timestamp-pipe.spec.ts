import { LocalTimestampPipe } from './local-timestamp-pipe';

describe('LocalTimestampPipe', () => {
  it('create an instance', () => {
    const pipe = new LocalTimestampPipe();
    expect(pipe).toBeTruthy();
  });
});
