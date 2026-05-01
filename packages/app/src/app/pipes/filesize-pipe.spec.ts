import { FilesizePipe } from './filesize-pipe';

describe('FilesizePipe', () => {
  let pipe: FilesizePipe;

  beforeEach(() => {
    pipe = new FilesizePipe();
  });

  it('creates an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('transforms 0 bytes to "0 B"', () => {
    expect(pipe.transform(0)).toBe('0 B');
  });

  it('transforms null to "0 B"', () => {
    expect(pipe.transform(null)).toBe('0 B');
  });

  it('transforms undefined to "0 B"', () => {
    expect(pipe.transform(undefined)).toBe('0 B');
  });

  it('transforms 1024 bytes to "1 KB"', () => {
    expect(pipe.transform(1024)).toBe('1 KB');
  });

  it('transforms 1048576 bytes to "1 MB"', () => {
    expect(pipe.transform(1048576)).toBe('1 MB');
  });

  it('transforms a numeric string', () => {
    expect(pipe.transform('2048')).toBe('2 KB');
  });

  it('transforms a bigint value', () => {
    expect(pipe.transform(1024n)).toBe('1 KB');
  });

  it('transforms an empty string to "0 B"', () => {
    expect(pipe.transform('')).toBe('0 B');
  });
});
