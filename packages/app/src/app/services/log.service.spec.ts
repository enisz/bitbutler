import { TestBed } from '@angular/core/testing';
import type { LogEntry } from '@bitbutler/shared';
import { LogService } from './log.service';

describe('LogService', () => {
  let service: LogService;
  let mockList: ReturnType<typeof vi.fn>;
  let mockClear: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockList = vi.fn().mockResolvedValue([]);
    mockClear = vi.fn().mockResolvedValue({ ok: true });
    (window as any).bitbutler = {
      ...(window as any).bitbutler,
      log: { ...(window as any).bitbutler?.log, list: mockList, clear: mockClear },
    };

    TestBed.configureTestingModule({});
    service = TestBed.inject(LogService);
  });

  it('list() returns the entries from window.bitbutler.log.list()', async () => {
    const entries: LogEntry[] = [
      {
        id: 1,
        timestamp: 1700000000,
        process: 'main',
        level: 'info',
        message: 'hi',
        context: null,
        filename: null,
        line: null,
      },
    ];
    mockList.mockResolvedValue(entries);

    expect(await service.list()).toEqual(entries);
  });

  it('clear() delegates to window.bitbutler.log.clear()', async () => {
    await service.clear();
    expect(mockClear).toHaveBeenCalled();
  });
});
