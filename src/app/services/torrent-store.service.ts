import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { Maindata, QbCategory, Torrent, TorrentMap, TorrentState } from '../models/torrent.model';

export interface TorrentTxnDelta {
  fullUpdate: boolean;
  add: Torrent[];
  update: Torrent[];
  remove: Torrent[];
}

export type TorrentFinishedEvent = {
  hash: string;
  torrent: Torrent;
  ts: number;
};

@Injectable({ providedIn: 'root' })
export class TorrentStoreService {
  private readonly _torrents = signal<TorrentMap>(new Map());
  private readonly _categories = signal<Map<string, QbCategory>>(new Map());
  private readonly _tags = signal<Set<string>>(new Set());

  readonly torrentsMap = this._torrents.asReadonly();
  readonly categoriesMap = this._categories.asReadonly();
  readonly tagsSet = this._tags.asReadonly();

  readonly torrentsArray = computed(() => Array.from(this._torrents().values()));
  readonly totalCount = computed(() => this._torrents().size);

  readonly countsByState = computed(() => {
    const result: Partial<Record<TorrentState, number>> = {};
    for (const t of this._torrents().values()) {
      result[t.state] = (result[t.state] ?? 0) + 1;
    }
    return result;
  });

  private readonly _finished$ = new Subject<TorrentFinishedEvent>();
  readonly finished$ = this._finished$.asObservable();
  private readonly finishedByHash = new Map<string, boolean>();
  private primed = false;

  applyMaindata(data: Maindata): TorrentTxnDelta {
    const incoming: Record<string, Partial<Torrent>> = data?.torrents ?? {};
    const removed: string[] = data?.torrents_removed ?? [];
    const fullUpdate = !!data?.full_update;

    const isStreamingChunk = !!(data as any)?._isStreamingChunk;

    const add: Torrent[] = [];
    const update: Torrent[] = [];
    const remove: Torrent[] = [];

    const prevMap = this._torrents();
    const next = new Map(prevMap);

    if (fullUpdate) {
      next.clear();

      for (const [hash, patch] of Object.entries(incoming)) {
        const t: Torrent = { ...(patch as Torrent), hash };
        next.set(hash, t);
        add.push(t);
      }

      this._torrents.set(next);

      this.ingestFinished(add, [], this.primed && !isStreamingChunk);
      if (!isStreamingChunk) this.primed = true;
    } else {
      for (const hash of removed) {
        const existing = next.get(hash);
        if (existing) {
          next.delete(hash);
          remove.push(existing);
        }
      }

      for (const [hash, patch] of Object.entries(incoming)) {
        const prev = next.get(hash);

        if (!prev) {
          const t: Torrent = { ...(patch as Torrent), hash };
          next.set(hash, t);
          add.push(t);
        } else {
          const t: Torrent = { ...prev, ...(patch as Torrent), hash };
          next.set(hash, t);
          update.push(t);
        }
      }

      this._torrents.set(next);

      this.ingestFinished(
        [...add, ...update],
        remove.map((r) => r.hash),
        this.primed && !isStreamingChunk,
      );
      if (!isStreamingChunk) this.primed = true;
    }

    if (data.full_update) {
      this._categories.set(new Map(Object.entries(data.categories ?? {})));
      this._tags.set(new Set(data.tags ?? []));
    } else {
      if (data.categories) {
        this._categories.update((categories) => {
          const newCategories = new Map(categories);
          for (const [name, category] of Object.entries(data.categories ?? {})) {
            newCategories.set(name, category);
          }
          return newCategories;
        });
      }
      if (data.categories_removed) {
        this._categories.update((categories) => {
          const newCategories = new Map(categories);
          for (const name of data.categories_removed ?? []) {
            newCategories.delete(name);
          }
          return newCategories;
        });
      }
      if (data.tags) {
        this._tags.update((tags) => {
          const newTags = new Set(tags);
          for (const tag of data.tags ?? []) {
            newTags.add(tag);
          }
          return newTags;
        });
      }
      if (data.tags_removed) {
        this._tags.update((tags) => {
          const newTags = new Set(tags);
          for (const tag of data.tags_removed ?? []) {
            newTags.delete(tag);
          }
          return newTags;
        });
      }
    }

    return { fullUpdate, add, update, remove };
  }

  clear() {
    this._torrents.set(new Map());
    this.finishedByHash.clear();
    this.primed = false;
    this._categories.set(new Map());
    this._tags.set(new Set());
  }

  private ingestFinished(changed: Torrent[], removedHashes: string[], allowEmit: boolean) {
    for (const hash of removedHashes) {
      this.finishedByHash.delete(hash);
    }

    const now = Date.now();

    for (const t of changed) {
      const hash = t.hash;

      const nowFinished = this.isFinished(t);
      const wasFinished = this.finishedByHash.get(hash) ?? false;

      if (allowEmit && !wasFinished && nowFinished) {
        this._finished$.next({ hash, torrent: t, ts: now });
      }

      this.finishedByHash.set(hash, nowFinished);
    }
  }

  private isFinished(t: Torrent): boolean {
    const seedingStates = [
      'uploading',
      'stalledUP',
      'queuedUP',
      'checkingUP',
      'forcedUP',
      'allocating',
    ];

    const isSeedingState = seedingStates.includes(t.state);

    const progressDone = (t.progress ?? 0) >= 0.999999;
    const amountLeftDone = t.amount_left === 0;

    return isSeedingState || (progressDone && amountLeftDone);
  }
}
