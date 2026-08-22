import { TestBed } from '@angular/core/testing';
import { FilesizePipe } from '../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../pipes/humanize-duration-pipe';
import { LocalTimestampPipe } from '../pipes/local-timestamp-pipe';
import { RatioLimitPipe } from '../pipes/ratio-limit-pipe';
import { RatioPipe } from '../pipes/ratio-pipe';
import { TimeLimitPipe } from '../pipes/time-limit-pipe';
import { UiFormatService } from './ui-format.service';

const makeParams = (value: any) => ({ value }) as any;

describe('UiFormatService', () => {
  let service: UiFormatService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UiFormatService,
        FilesizePipe,
        HumanizeDurationPipe,
        LocalTimestampPipe,
        RatioPipe,
        RatioLimitPipe,
        TimeLimitPipe,
      ],
    });
    service = TestBed.inject(UiFormatService);
  });

  it('should return a string from fileSize()', () => {
    const result = service.fileSize(makeParams(1024 * 1024));
    expect(typeof result).toBe('string');
  });

  it('should append /s to fileSizePerSecond()', () => {
    const result = service.fileSizePerSecond(makeParams(1024));
    expect(result.endsWith('/s')).toBe(true);
  });

  it('should return a string from duration()', () => {
    const result = service.duration(makeParams(3600000));
    expect(typeof result).toBe('string');
  });

  it('should return a string from durationSeconds()', () => {
    const result = service.durationSeconds(makeParams(3600));
    expect(typeof result).toBe('string');
  });

  it('should return a string from ratio()', () => {
    const result = service.ratio(makeParams(1.5));
    expect(typeof result).toBe('string');
  });

  it('should return a string from ratioLimit()', () => {
    const result = service.ratioLimit(makeParams(-1));
    expect(typeof result).toBe('string');
  });

  it('should return the no-limit translation key from ratioLimit() for undefined', () => {
    const result = service.ratioLimit(makeParams(undefined));
    expect(result).toBe('general.limit.no-limit');
  });

  it('should return a string from timeLimit()', () => {
    const result = service.timeLimit(makeParams(-1));
    expect(typeof result).toBe('string');
  });

  it('should return a string from localTimestamp()', () => {
    const result = service.localTimestamp(makeParams(1700000000));
    expect(typeof result).toBe('string');
  });

  describe('utcDateComparator', () => {
    it('should return -1 when cellValue is null', () => {
      const result = service.utcDateComparator(new Date(), null as any);
      expect(result).toBe(-1);
    });

    it('should return 0 when cell date equals filter date', () => {
      const filterDate = new Date(2024, 0, 15);
      const cellTimestamp = Date.UTC(2024, 0, 15) / 1000;
      const result = service.utcDateComparator(filterDate, cellTimestamp);
      expect(result).toBe(0);
    });

    it('should return -1 when cell date is before filter date', () => {
      const filterDate = new Date(2024, 0, 15);
      const cellTimestamp = Date.UTC(2024, 0, 10) / 1000;
      const result = service.utcDateComparator(filterDate, cellTimestamp);
      expect(result).toBe(-1);
    });

    it('should return 1 when cell date is after filter date', () => {
      const filterDate = new Date(2024, 0, 15);
      const cellTimestamp = Date.UTC(2024, 0, 20) / 1000;
      const result = service.utcDateComparator(filterDate, cellTimestamp);
      expect(result).toBe(1);
    });
  });
});
