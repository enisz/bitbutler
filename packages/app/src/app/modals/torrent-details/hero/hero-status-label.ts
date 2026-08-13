import { TorrentState } from '../../../models/torrent.model';

const HERO_STATUS_SUFFIX: Record<TorrentState, string> = {
  error: 'error',
  missingFiles: 'missing-files',
  uploading: 'seeding',
  pausedUP: 'paused',
  stoppedUP: 'stopped',
  queuedUP: 'queued',
  stalledUP: 'stalled',
  checkingUP: 'checking',
  forcedUP: 'forced',
  allocating: 'allocating',
  downloading: 'downloading',
  metaDL: 'fetching-metadata',
  pausedDL: 'paused',
  stoppedDL: 'stopped',
  queuedDL: 'queued',
  stalledDL: 'stalled',
  checkingDL: 'checking',
  forcedDL: 'forced',
  checkingResumeData: 'checking',
  moving: 'moving',
  unknown: 'unknown',
};

export function heroStatusLabelKey(state: TorrentState | undefined): string {
  const suffix = state ? (HERO_STATUS_SUFFIX[state] ?? 'unknown') : 'unknown';
  return `components.modals.torrent-details.hero.status.${suffix}`;
}
