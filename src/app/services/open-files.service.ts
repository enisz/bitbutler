import { Injectable, signal } from '@angular/core';
import type { SelectedTorrentInput } from '../models/command.model';
import type { TorrentDraft } from '../models/torrent-draft.model';

export type PendingAddTorrent = {
  draft: TorrentDraft;
  selected: SelectedTorrentInput;
};

type Unsub = () => void;

@Injectable({ providedIn: 'root' })
export class OpenFilesService {
  readonly pending = signal<string[]>([]);

  readonly pendingDrafts = signal<PendingAddTorrent[]>([]);

  private started = false;
  private unsubPaths: Unsub | null = null;
  private unsubDrafts: Unsub | null = null;

  private readonly seenRecent = new Map<string, number>();
  private readonly RECENT_WINDOW_MS = 1500;

  start(): void {
    if (this.started) return;
    this.started = true;

    this.unsubPaths = window.bitbutler.window.onOpenFiles((paths: string[]) => {
      const safe = Array.isArray(paths)
        ? paths.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean)
        : [];
      if (!safe.length) return;

      this.pending.update((prev) => {
        const merged = [...prev, ...safe];
        return Array.from(new Set(merged));
      });
    });

    this.unsubDrafts = window.bitbutler.window.onTorrentDrafts((drafts: TorrentDraft[]) => {
      const safe = Array.isArray(drafts) ? drafts.filter(Boolean) : [];
      if (!safe.length) return;

      this.pending.set([]);

      this.pendingDrafts.update((prev) => {
        const mapped: PendingAddTorrent[] = [];

        for (const d of safe) {
          const path = (d.originalPath ?? '').trim();

          if (!path) continue;

          const originalName =
            (d.originalName?.trim() && d.originalName.trim()) ||
            (path.split(/[\\/]/).pop() ?? 'torrent.torrent');

          const selected: SelectedTorrentInput = { name: originalName, path };

          const infoHash =
            d.torrent?.infoHashV1?.toLowerCase().trim() ||
            d.torrent?.infoHashV2?.toLowerCase().trim() ||
            '';

          const key =
            (infoHash && `hash:${infoHash}`) || (path && `path:${path}`) || `name:${originalName}`;

          const now = Date.now();
          const prevTs = this.seenRecent.get(key) ?? 0;
          this.seenRecent.set(key, now);
          if (now - prevTs < this.RECENT_WINDOW_MS) {
            continue;
          }

          mapped.push({ draft: d, selected });
        }

        if (!mapped.length) return prev;

        const merged = [...prev, ...mapped];

        const out: PendingAddTorrent[] = [];
        const seen = new Set<string>();

        for (const item of merged) {
          const d = item.draft;

          const path = (d.originalPath ?? '').trim();
          const infoHash =
            d.torrent?.infoHashV1?.toLowerCase().trim() ||
            d.torrent?.infoHashV2?.toLowerCase().trim() ||
            '';

          const key =
            (infoHash && `hash:${infoHash}`) ||
            (path && `path:${path}`) ||
            `name:${item.selected.name}`;

          if (seen.has(key)) continue;
          seen.add(key);
          out.push(item);
        }

        return out;
      });
    });
  }

  stop(): void {
    this.unsubPaths?.();
    this.unsubPaths = null;

    this.unsubDrafts?.();
    this.unsubDrafts = null;

    this.started = false;
  }

  drainDrafts(): PendingAddTorrent[] {
    const cur = this.pendingDrafts();
    this.pendingDrafts.set([]);
    return cur;
  }

  consumeCurrentDraft(): void {
    this.pendingDrafts.update((prev) => {
      const out = [...prev];
      out.shift();
      return out;
    });
  }
}
