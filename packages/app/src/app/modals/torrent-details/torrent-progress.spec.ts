import { isDownloadingState, normalizeProgressPercent } from './torrent-progress';

describe('normalizeProgressPercent', () => {
  it('converts a 0..1 fraction to a rounded percent', () => {
    expect(normalizeProgressPercent(0.4567)).toBe(46);
  });

  it('passes through values already expressed as 0..100', () => {
    expect(normalizeProgressPercent(87)).toBe(87);
  });

  it('returns 0 for a zero fraction', () => {
    expect(normalizeProgressPercent(0)).toBe(0);
  });

  it('returns 0 for null or undefined', () => {
    expect(normalizeProgressPercent(null)).toBe(0);
    expect(normalizeProgressPercent(undefined)).toBe(0);
  });
});

describe('isDownloadingState', () => {
  it('returns true for downloading-related states', () => {
    expect(isDownloadingState('downloading')).toBe(true);
    expect(isDownloadingState('pausedDL')).toBe(true);
    expect(isDownloadingState('stoppedDL')).toBe(true);
    expect(isDownloadingState('queuedDL')).toBe(true);
    expect(isDownloadingState('stalledDL')).toBe(true);
    expect(isDownloadingState('checkingDL')).toBe(true);
    expect(isDownloadingState('forcedDL')).toBe(true);
  });

  it('returns false for upload/seeding states', () => {
    expect(isDownloadingState('uploading')).toBe(false);
    expect(isDownloadingState('pausedUP')).toBe(false);
    expect(isDownloadingState('stalledUP')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isDownloadingState(undefined)).toBe(false);
  });
});
