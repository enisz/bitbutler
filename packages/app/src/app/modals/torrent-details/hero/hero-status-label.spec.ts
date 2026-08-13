import { heroStatusLabelKey } from './hero-status-label';

describe('heroStatusLabelKey', () => {
  it('maps downloading to the downloading key', () => {
    expect(heroStatusLabelKey('downloading')).toBe(
      'components.modals.torrent-details.hero.status.downloading',
    );
  });

  it('groups pausedDL and pausedUP under the same paused key', () => {
    expect(heroStatusLabelKey('pausedDL')).toBe(
      'components.modals.torrent-details.hero.status.paused',
    );
    expect(heroStatusLabelKey('pausedUP')).toBe(
      'components.modals.torrent-details.hero.status.paused',
    );
  });

  it('groups uploading under the seeding key', () => {
    expect(heroStatusLabelKey('uploading')).toBe(
      'components.modals.torrent-details.hero.status.seeding',
    );
  });

  it('groups the three checking states under the checking key', () => {
    expect(heroStatusLabelKey('checkingDL')).toBe(
      'components.modals.torrent-details.hero.status.checking',
    );
    expect(heroStatusLabelKey('checkingUP')).toBe(
      'components.modals.torrent-details.hero.status.checking',
    );
    expect(heroStatusLabelKey('checkingResumeData')).toBe(
      'components.modals.torrent-details.hero.status.checking',
    );
  });

  it('falls back to unknown for an undefined state', () => {
    expect(heroStatusLabelKey(undefined)).toBe(
      'components.modals.torrent-details.hero.status.unknown',
    );
  });
});
