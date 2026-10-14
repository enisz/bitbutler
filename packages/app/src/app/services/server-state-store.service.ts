import { Injectable, signal } from '@angular/core';
import { QbServerState } from '../models/torrent.model';

/**
 * The latest qBittorrent server state (connection status, speeds, free space, ...).
 *
 * qBittorrent's incremental sync only sends the fields that changed, so the state has to
 * outlive the torrent list page: when that page is recreated (for example after a visit to the
 * settings pages) and polling resumes for the same server, the unchanged fields are not sent
 * again.
 */
@Injectable({ providedIn: 'root' })
export class ServerStateStoreService {
  public readonly state = signal<QbServerState | null>(null);

  private serverId: string | null = null;

  /** Forgets the state when the polled server changes; keeps it for the same server. */
  public useServer(serverId: string | null): void {
    if (serverId === this.serverId) return;

    this.serverId = serverId;
    this.state.set(null);
  }

  public merge(patch: QbServerState | null | undefined): void {
    this.state.update((previous) => mergeServerState(previous, patch));
  }
}

function mergeServerState(
  prev: QbServerState | null,
  patch: QbServerState | null | undefined,
): QbServerState | null {
  if (!patch) return prev;
  if (!prev) return patch;

  const out: QbServerState = { ...prev };
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}
