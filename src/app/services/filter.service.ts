import { Injectable } from '@angular/core';
import type { FilterModel } from 'ag-grid-community';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { TorrentState } from '../models/torrent.model';

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

function shallowEqualFilterModel(a: FilterModel, b: FilterModel): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

function shallowEqualExternal(a: GridExternalFilterParams, b: GridExternalFilterParams): boolean {
  if (a.search !== b.search) return false;

  if (a.states.size !== b.states.size) return false;
  for (const s of a.states) if (!b.states.has(s)) return false;

  if (a.trackers.size !== b.trackers.size) return false;
  for (const t of a.trackers) if (!b.trackers.has(t)) return false;

  if (a.savePaths.size !== b.savePaths.size) return false;
  for (const p of a.savePaths) if (!b.savePaths.has(p)) return false;

  if (a.categories.size !== b.categories.size) return false;
  for (const c of a.categories) if (!b.categories.has(c)) return false;

  if (a.tags.size !== b.tags.size) return false;
  for (const t of a.tags) if (!b.tags.has(t)) return false;

  return true;
}

@Injectable({ providedIn: 'root' })
export class FilterService {
  private readonly _state$ = new BehaviorSubject<GridFilterState>(GRID_FILTER_INITIAL);

  public readonly state$: Observable<GridFilterState> = this._state$.asObservable();

  public readonly external$: Observable<GridExternalFilterParams> = this.state$.pipe(
    map((s) => s.external),
    distinctUntilChanged(shallowEqualExternal),
  );

  public readonly columnModel$: Observable<FilterModel> = this.state$.pipe(
    map((s) => s.columns),
    distinctUntilChanged(shallowEqualFilterModel),
  );

  public readonly search$: Observable<string> = this.external$.pipe(
    map((e) => e.search),
    distinctUntilChanged(),
  );

  public get snapshot(): GridFilterState {
    return this._state$.value;
  }

  public get activeStates(): ReadonlySet<TorrentState> {
    return this._state$.value.external.states;
  }

  public setSearch(search: string): void {
    const value = (search ?? '').trim();
    const curr = this._state$.value;
    if (curr.external.search === value) return;

    this._state$.next({
      ...curr,
      external: { ...curr.external, search: value },
    });
  }

  public clearSearch(): void {
    this.setSearch('');
  }

  public setStates(states: Iterable<TorrentState>): void {
    const nextStates = new Set<TorrentState>(states);
    const curr = this._state$.value;

    if (curr.external.states.size === nextStates.size) {
      let same = true;
      for (const s of nextStates) {
        if (!curr.external.states.has(s)) {
          same = false;
          break;
        }
      }
      if (same) return;
    }

    this._state$.next({
      ...curr,
      external: { ...curr.external, states: nextStates },
    });
  }

  public clearStates(): void {
    this.setStates([]);
  }

  public setTrackers(trackers: Iterable<string>): void {
    const nextSet = new Set<string>(Array.from(trackers, (t) => (t ?? '').trim()).filter(Boolean));
    const curr = this._state$.value;

    if (curr.external.trackers.size === nextSet.size) {
      let same = true;
      for (const t of nextSet) {
        if (!curr.external.trackers.has(t)) {
          same = false;
          break;
        }
      }
      if (same) return;
    }

    this._state$.next({
      ...curr,
      external: { ...curr.external, trackers: nextSet },
    });
  }

  public clearTrackers(): void {
    this.setTrackers([]);
  }

  public setSavePaths(paths: Iterable<string>): void {
    const nextSet = new Set<string>(Array.from(paths, (p) => (p ?? '').trim()).filter(Boolean));
    const curr = this._state$.value;

    if (curr.external.savePaths.size === nextSet.size) {
      let same = true;
      for (const p of nextSet) {
        if (!curr.external.savePaths.has(p)) {
          same = false;
          break;
        }
      }
      if (same) return;
    }

    this._state$.next({
      ...curr,
      external: { ...curr.external, savePaths: nextSet },
    });
  }

  public clearSavePaths(): void {
    this.setSavePaths([]);
  }

  public setCategories(categories: Iterable<string>): void {
    const nextSet = new Set<string>(
      Array.from(categories, (c) => (c ?? '').trim()).filter(Boolean),
    );
    const curr = this._state$.value;

    if (curr.external.categories.size === nextSet.size) {
      let same = true;
      for (const c of nextSet) {
        if (!curr.external.categories.has(c)) {
          same = false;
          break;
        }
      }
      if (same) return;
    }

    this._state$.next({
      ...curr,
      external: { ...curr.external, categories: nextSet },
    });
  }

  public clearCategories(): void {
    this.setCategories([]);
  }

  public setTags(tags: Iterable<string>): void {
    const nextSet = new Set<string>(Array.from(tags, (t) => (t ?? '').trim()).filter(Boolean));
    const curr = this._state$.value;

    if (curr.external.tags.size === nextSet.size) {
      let same = true;
      for (const t of nextSet) {
        if (!curr.external.tags.has(t)) {
          same = false;
          break;
        }
      }
      if (same) return;
    }

    this._state$.next({
      ...curr,
      external: { ...curr.external, tags: nextSet },
    });
  }

  public clearTags(): void {
    this.setTags([]);
  }

  public setColumnModel(model: FilterModel): void {
    const curr = this._state$.value;
    const next = model ?? {};
    if (shallowEqualFilterModel(curr.columns, next)) return;

    this._state$.next({ ...curr, columns: next });
  }

  public setColumnFilter(colId: string, filter: unknown): void {
    const id = (colId ?? '').trim();
    if (!id) return;

    const curr = this._state$.value;
    const next: FilterModel = { ...(curr.columns ?? {}) };

    if (filter == null) delete next[id];
    else (next as any)[id] = filter;

    if (shallowEqualFilterModel(curr.columns, next)) return;
    this._state$.next({ ...curr, columns: next });
  }

  public clearColumnFilter(colId: string): void {
    this.setColumnFilter(colId, null);
  }

  public clearAllColumnFilters(): void {
    const curr = this._state$.value;
    if (Object.keys(curr.columns ?? {}).length === 0) return;
    this._state$.next({ ...curr, columns: {} });
  }

  public resetAll(): void {
    this._state$.next({
      external: {
        search: '',
        states: new Set<TorrentState>(),
        trackers: new Set<string>(),
        savePaths: new Set<string>(),
        categories: new Set<string>(),
        tags: new Set<string>(),
      },
      columns: {},
    });
  }
}
