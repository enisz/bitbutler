import { SpeedLimitPipe } from './speed-limit-pipe';

describe('SpeedLimitPipe', () => {
  let pipe: SpeedLimitPipe;

  beforeEach(() => {
    pipe = new SpeedLimitPipe();
  });

  it('creates an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('returns "-" for a limit of 0 (no limit set)', () => {
    expect(pipe.transform(0)).toBe('-');
  });

  it('returns "-" for a negative limit', () => {
    expect(pipe.transform(-1)).toBe('-');
  });

  it('formats a speed limit in bytes/s', () => {
    expect(pipe.transform(1024)).toBe('1 KB/s');
  });

  it('formats a speed limit in MB/s', () => {
    expect(pipe.transform(1048576)).toBe('1 MB/s');
  });

  it('appends "/s" suffix to the formatted size', () => {
    expect(pipe.transform(2048)).toMatch(/\/s$/);
  });
});
