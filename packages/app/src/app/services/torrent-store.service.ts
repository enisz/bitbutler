import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { ValueCount } from '../components/column-filters/set-column-filter/set-column-filter';
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

export type { ValueCount };

@Injectable({ providedIn: 'root' })
export class TorrentStoreService {
  private readonly _torrents = signal<TorrentMap>(new Map());
  private readonly _categories = signal<Map<string, QbCategory>>(new Map());
  private readonly _tags = signal<Set<string>>(new Set());

  readonly torrentsMap = this._torrents.asReadonly();
  readonly categoriesMap = this._categories.asReadonly();
  readonly tagsSet = this._tags.asReadonly();

  readonly torrentsArray = computed(() => Array.from(this._torrents().values()));
  readonly torrents = this.torrentsArray;
  readonly totalCount = computed(() => this._torrents().size);

  readonly countsByState = computed(() => {
    const result: Partial<Record<TorrentState, number>> = {};
    for (const t of this._torrents().values()) {
      result[t.state] = (result[t.state] ?? 0) + 1;
    }
    return result;
  });

  readonly categoriesWithCounts = computed<ValueCount[]>(() => {
    const counts = new Map<string, number>();
    for (const t of this._torrents().values()) {
      if (t.category) {
        counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
      }
    }

    const names = new Set([...this._categories().keys(), ...counts.keys()]);
    return [...names]
      .map((name) => ({ key: name, label: name, count: counts.get(name) ?? 0 }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly tagsWithCounts = computed<ValueCount[]>(() => {
    const counts = new Map<string, number>();
    for (const t of this._torrents().values()) {
      if (t.tags) {
        for (const tag of t.tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
    }

    const names = new Set([...this._tags(), ...counts.keys()]);
    return [...names]
      .map((name) => ({ key: name, label: name, count: counts.get(name) ?? 0 }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly statesWithCounts = computed<ValueCount[]>(() => {
    const counts = this.countsByState();
    return Object.entries(counts)
      .map(([key, count]) => ({
        key,
        label: key,
        count: count ?? 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  private readonly _finished$ = new Subject<TorrentFinishedEvent>();
  readonly finished$ = this._finished$.asObservable();
  private readonly finishedByHash = new Map<string, boolean>();
  private readonly _delta$ = new Subject<TorrentTxnDelta>();
  readonly delta$ = this._delta$.asObservable();
  private readonly _isPrimed = signal(false);
  readonly isPrimed = this._isPrimed.asReadonly();

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

      this.ingestFinished(add, [], this._isPrimed() && !isStreamingChunk);
      if (!isStreamingChunk) this._isPrimed.set(true);
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

      // Skip the signal update on a no-op delta - setting an unchanged Map still creates a new
      // reference, which would recompute torrentsArray and cascade into a full grid
      // reconciliation on every poll tick even when nothing actually changed.
      if (add.length || update.length || remove.length) {
        this._torrents.set(next);
      }

      this.ingestFinished(
        [...add, ...update],
        remove.map((r) => r.hash),
        this._isPrimed() && !isStreamingChunk,
      );
      if (!isStreamingChunk) this._isPrimed.set(true);
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

    const delta: TorrentTxnDelta = { fullUpdate, add, update, remove };
    this._delta$.next(delta);
    return delta;
  }

  clear() {
    this._torrents.set(new Map());
    this.finishedByHash.clear();
    this._isPrimed.set(false);
    this._categories.set(new Map());
    this._tags.set(new Set());
    this._delta$.next({ fullUpdate: true, add: [], update: [], remove: [] });
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
