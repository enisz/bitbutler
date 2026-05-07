import { Torrent } from '../../models/torrent.model';
import { getTrackers, normalizeTracker } from './tracker.utils';

describe('getTrackers', () => {
  it('should split tracker field by newline and filter empty strings', () => {
    const t = { tracker: 'udp://tracker1.com\nudp://tracker2.com\n' } as Torrent;
    expect(getTrackers(t)).toEqual(['udp://tracker1.com', 'udp://tracker2.com']);
  });

  it('should return empty array when tracker is null', () => {
    expect(getTrackers({ tracker: null } as any)).toEqual([]);
  });

  it('should return empty array when tracker is undefined', () => {
    expect(getTrackers({} as Torrent)).toEqual([]);
  });
});

describe('normalizeTracker', () => {
  it('should return (none) for empty string', () => {
    expect(normalizeTracker('')).toBe('(none)');
  });

  it('should return (none) for null', () => {
    expect(normalizeTracker(null)).toBe('(none)');
  });

  it('should return (none) for undefined', () => {
    expect(normalizeTracker(undefined)).toBe('(none)');
  });

  it('should extract host from a valid URL', () => {
    expect(normalizeTracker('udp://tracker.example.com:6969/announce')).toBe(
      'tracker.example.com:6969',
    );
  });

  it('should return raw string for non-URL values', () => {
    expect(normalizeTracker('not-a-url')).toBe('not-a-url');
  });
});
