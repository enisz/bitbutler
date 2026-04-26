import { Torrent } from '../../models/torrent.model';

export function getTrackers(t: Torrent): string[] {
  return (t.tracker ?? '').split('\n').filter(Boolean);
}

export function normalizeTracker(raw?: string | null): string {
  const s = (raw ?? '').trim();
  if (!s) return '(none)';
  try {
    const u = new URL(s);
    return u.host || u.hostname || s;
  } catch {
    return s;
  }
}
