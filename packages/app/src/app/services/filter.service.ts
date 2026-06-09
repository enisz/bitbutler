import { Injectable, computed, inject, signal } from '@angular/core';
import type { FilterModel } from 'ag-grid-community';
import { Torrent, TorrentState } from '../models/torrent.model';
import { TorrentStoreService } from './torrent-store.service';

export type GridExternalFilterParams = {
  search: string;
  states: Set<TorrentState>;
  trackers: Set<string>;
  savePaths: Set<string>;
  categories: Set<string>;
  tags: Set<string>;
};

export type GridFilterState = {
  external: GridExternalFilterParams;
  columns: FilterModel;
};

export const GRID_FILTER_INITIAL: GridFilterState = {
  external: {
    search: '',
    states: new Set<TorrentState>(),
    trackers: new Set<string>(),
    savePaths: new Set<string>(),
    categories: new Set<string>(),
    tags: new Set<string>(),
  },
  columns: {},
};

function shallowEqualSets<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function shallowEqualExternal(a: GridExternalFilterParams, b: GridExternalFilterParams): boolean {
  return (
    a.search === b.search &&
    shallowEqualSets(a.states, b.states) &&
    shallowEqualSets(a.trackers, b.trackers) &&
    shallowEqualSets(a.savePaths, b.savePaths) &&
    shallowEqualSets(a.categories, b.categories) &&
    shallowEqualSets(a.tags, b.tags)
  );
}

function shallowEqualFilterModel(a: FilterModel, b: FilterModel): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

@Injectable({ providedIn: 'root' })
export class FilterService {
  private readonly torrentStore = inject(TorrentStoreService);

  private readonly _external = signal<GridExternalFilterParams>(GRID_FILTER_INITIAL.external, {
    equal: shallowEqualExternal,
  });
  private readonly _columns = signal<FilterModel>(GRID_FILTER_INITIAL.columns, {
    equal: shallowEqualFilterModel,
  });

  readonly external = this._external.asReadonly();
  readonly columns = this._columns.asReadonly();

  readonly filtered = computed<Torrent[]>(() => {
    const params = this._external();
    const all = this.torrentStore.torrentsArray();
    if (
      !params.search &&
      params.states.size === 0 &&
      params.trackers.size === 0 &&
      params.savePaths.size === 0 &&
      params.categories.size === 0 &&
      params.tags.size === 0
    ) {
      return all;
    }
    return all.filter((t) => {
      if (params.search && !t.name.toLowerCase().includes(params.search.toLowerCase())) {
        return false;
      }
      if (params.states.size > 0 && !params.states.has(t.state)) {
        return false;
      }
      if (params.categories.size > 0 && !params.categories.has(t.category)) {
        return false;
      }
      if (params.savePaths.size > 0 && !params.savePaths.has(t.save_path)) {
        return false;
      }
      if (params.trackers.size > 0) {
        const tracker = (t.tracker ?? '').trim();
        if (!params.trackers.has(tracker)) return false;
      }
      if (params.tags.size > 0) {
        const torrentTags = new Set(
          t.tags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        );
        if (![...params.tags].some((tag) => torrentTags.has(tag))) {
          return false;
        }
      }
      return true;
    });
  });

  public get snapshot(): GridFilterState {
    return { external: this._external(), columns: this._columns() };
  }

  public get activeStates(): ReadonlySet<TorrentState> {
    return this._external().states;
  }

  public setSearch(search: string): void {
    const value = (search ?? '').trim();
    this._external.update((prev) => ({ ...prev, search: value }));
  }

  public clearSearch(): void {
    this.setSearch('');
  }

  public setStates(states: Iterable<TorrentState>): void {
    this._external.update((prev) => ({ ...prev, states: new Set<TorrentState>(states) }));
  }

  public clearStates(): void {
    this.setStates([]);
  }

  public setTrackers(trackers: Iterable<string>): void {
    const next = new Set<string>(Array.from(trackers, (t) => (t ?? '').trim()).filter(Boolean));
    this._external.update((prev) => ({ ...prev, trackers: next }));
  }

  public clearTrackers(): void {
    this.setTrackers([]);
  }

  public setSavePaths(paths: Iterable<string>): void {
    const next = new Set<string>(Array.from(paths, (p) => (p ?? '').trim()).filter(Boolean));
    this._external.update((prev) => ({ ...prev, savePaths: next }));
  }

  public clearSavePaths(): void {
    this.setSavePaths([]);
  }

  public setCategories(categories: Iterable<string>): void {
    const next = new Set<string>(Array.from(categories, (c) => (c ?? '').trim()).filter(Boolean));
    this._external.update((prev) => ({ ...prev, categories: next }));
  }

  public clearCategories(): void {
    this.setCategories([]);
  }

  public setTags(tags: Iterable<string>): void {
    const next = new Set<string>(Array.from(tags, (t) => (t ?? '').trim()).filter(Boolean));
    this._external.update((prev) => ({ ...prev, tags: next }));
  }

  public clearTags(): void {
    this.setTags([]);
  }

  public setColumnModel(model: FilterModel): void {
    this._columns.set(model ?? {});
  }

  public setColumnFilter(colId: string, filter: unknown): void {
    const id = (colId ?? '').trim();
    if (!id) return;
    this._columns.update((prev) => {
      const next: FilterModel = { ...(prev ?? {}) };
      if (filter == null) delete next[id];
      else (next as any)[id] = filter;
      return next;
    });
  }

  public clearColumnFilter(colId: string): void {
    this.setColumnFilter(colId, null);
  }

  public clearAllColumnFilters(): void {
    this._columns.set({});
  }

  public resetAll(): void {
    this._external.set({
      search: '',
      states: new Set<TorrentState>(),
      trackers: new Set<string>(),
      savePaths: new Set<string>(),
      categories: new Set<string>(),
      tags: new Set<string>(),
    });
    this._columns.set({});
  }
}
