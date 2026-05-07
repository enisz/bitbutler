import { BbProgressState } from './bb-progress.types';
import { variantForTorrentState } from './torrent-state-variant';

describe('variantForTorrentState', () => {
  it('returns "danger" for error', () => {
    expect(variantForTorrentState('error')).toBe('danger');
  });

  it('returns "danger" for missingFiles', () => {
    expect(variantForTorrentState('missingFiles')).toBe('danger');
  });

  it('returns "secondary" for pausedDL', () => {
    expect(variantForTorrentState('pausedDL')).toBe('secondary');
  });

  it('returns "secondary" for pausedUP', () => {
    expect(variantForTorrentState('pausedUP')).toBe('secondary');
  });

  it('returns "secondary" for stoppedDL', () => {
    expect(variantForTorrentState('stoppedDL')).toBe('secondary');
  });

  it('returns "secondary" for stoppedUP', () => {
    expect(variantForTorrentState('stoppedUP')).toBe('secondary');
  });

  it('returns "secondary" for queuedDL', () => {
    expect(variantForTorrentState('queuedDL')).toBe('secondary');
  });

  it('returns "secondary" for queuedUP', () => {
    expect(variantForTorrentState('queuedUP')).toBe('secondary');
  });

  it('returns "warning" for stalledDL', () => {
    expect(variantForTorrentState('stalledDL')).toBe('warning');
  });

  it('returns "warning" for stalledUP', () => {
    expect(variantForTorrentState('stalledUP')).toBe('warning');
  });

  it('returns "success" for uploading', () => {
    expect(variantForTorrentState('uploading')).toBe('success');
  });

  it('returns "success" for forcedUP', () => {
    expect(variantForTorrentState('forcedUP')).toBe('success');
  });

  it('returns "info" for downloading', () => {
    expect(variantForTorrentState('downloading')).toBe('info');
  });

  it('returns "info" for forcedDL', () => {
    expect(variantForTorrentState('forcedDL')).toBe('info');
  });

  it('returns "primary" for checkingDL', () => {
    expect(variantForTorrentState('checkingDL')).toBe('primary');
  });

  it('returns "primary" for checkingUP', () => {
    expect(variantForTorrentState('checkingUP')).toBe('primary');
  });

  it('returns "primary" for checkingResumeData', () => {
    expect(variantForTorrentState('checkingResumeData')).toBe('primary');
  });

  it('returns "primary" for metaDL', () => {
    expect(variantForTorrentState('metaDL')).toBe('primary');
  });

  it('returns "primary" for allocating', () => {
    expect(variantForTorrentState('allocating')).toBe('primary');
  });

  it('returns "primary" for moving', () => {
    expect(variantForTorrentState('moving')).toBe('primary');
  });

  it('returns "secondary" for unknown state', () => {
    expect(variantForTorrentState('unknown' as BbProgressState)).toBe('secondary');
  });
});
