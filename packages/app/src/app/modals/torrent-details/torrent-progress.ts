import { TorrentState } from '../../models/torrent.model';

const DOWNLOADING_STATES: ReadonlySet<TorrentState> = new Set<TorrentState>([
  'downloading',
  'pausedDL',
  'stoppedDL',
  'queuedDL',
  'stalledDL',
  'checkingDL',
  'forcedDL',
]);

export function normalizeProgressPercent(progress: number | undefined | null): number {
  const p = progress ?? 0;
  const normalized = p > 0 && p <= 1 ? p * 100 : p;
  return Math.round(normalized);
}

export function isDownloadingState(state: TorrentState | undefined): boolean {
  return !!state && DOWNLOADING_STATES.has(state);
}
