import { FileSizePerSecPipe } from './filesize-per-sec-pipe';

describe('FileSizePerSecPipe', () => {
  let pipe: FileSizePerSecPipe;

  beforeEach(() => {
    pipe = new FileSizePerSecPipe();
  });

  it('creates an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('transforms 0 to ""', () => {
    expect(pipe.transform(0)).toBe('');
  });

  it('transforms null to ""', () => {
    expect(pipe.transform(null)).toBe('');
  });

  it('transforms undefined to ""', () => {
    expect(pipe.transform(undefined)).toBe('');
  });

  it('transforms 1024 to "1 KB/s"', () => {
    expect(pipe.transform(1024)).toBe('1 KB/s');
  });

  it('transforms 1048576 to "1 MB/s"', () => {
    expect(pipe.transform(1048576)).toBe('1 MB/s');
  });
});
