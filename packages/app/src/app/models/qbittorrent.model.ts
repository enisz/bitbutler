import type {
  QbAppPreferences,
  QbLogEntry,
  QbLogPeerEntry,
  QbSetAppPreferences,
  QbTorrentProperties,
  QbTorrentTracker,
} from '@bitbutler/shared';

export { QbLogMessageType, QbTrackerStatus } from '@bitbutler/shared';
export type {
  QbAppPreferences,
  QbLogEntry,
  QbLogPeerEntry,
  QbSetAppPreferences,
  QbTorrentProperties,
  QbTorrentTracker,
};

export interface QbResponse<T> {
  ok: boolean;
  status: number;
  statusText: string;
  body: T;
  path?: string;
}
