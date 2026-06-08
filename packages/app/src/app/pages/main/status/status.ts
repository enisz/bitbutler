import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCircleCheck,
  faCircleDown,
  faCircleExclamation,
  faCircleMinus,
  faCircleNotch,
  faCirclePlay,
  faCircleStop,
  faFolderOpen,
  faFolderTree,
  faHourglassHalf,
  faLink,
  faPlay,
  faTags,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Torrent, TorrentState } from '../../../models/torrent.model';
import { FilterService } from '../../../services/filter.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { getTrackers, normalizeTracker } from '../tracker.utils';
import { FilterGroupComponent, FilterItem } from './filter-group/filter-group';

type CountItem = { key: string; label: string; count: number };

type StatusKey =
  | 'all'
  | 'downloading'
  | 'completed'
  | 'active'
  | 'inactive'
  | 'stopped'
  | 'checking'
  | 'errored';

@Component({
  selector: 'app-status',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, FilterGroupComponent, TranslatePipe],
  templateUrl: './status.html',
  styleUrl: './status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Status {
  private readonly store = inject(TorrentStoreService);
  private readonly filterService = inject(FilterService);
  private readonly translateService = inject(TranslateService);
  private readonly filtersSig = this.filterService.external;
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  readonly totalCount = this.store.totalCount;
  readonly countsByState = this.store.countsByState;

  readonly hasNoTrackerFilters = computed(() => this.filtersSig().trackers.size === 0);
  readonly hasNoSavePathFilters = computed(() => this.filtersSig().savePaths.size === 0);
  readonly hasAnyFilter = computed(() => {
    const f = this.filtersSig();
    return (
      f.states.size > 0 ||
      f.trackers.size > 0 ||
      f.savePaths.size > 0 ||
      f.categories.size > 0 ||
      f.tags.size > 0
    );
  });

  readonly icon = {
    faCircleDown,
    faUpload,
    faCircleCheck,
    faPlay,
    faCircleStop,
    faCirclePlay,
    faCircleMinus,
    faHourglassHalf,
    faCircleNotch,
    faCircleExclamation,
    faLink,
    faFolderOpen,
    faFolderTree,
    faTags,
  };

  private readonly groups: Record<StatusKey, TorrentState[]> = {
    all: [],
    downloading: ['downloading', 'forcedDL', 'queuedDL', 'metaDL', 'stalledDL'],
    completed: [
      'uploading',
      'pausedUP',
      'stoppedUP',
      'queuedUP',
      'stalledUP',
      'checkingUP',
      'forcedUP',
    ],
    active: ['downloading', 'uploading', 'forcedDL', 'forcedUP', 'metaDL', 'moving', 'allocating'],
    inactive: ['queuedDL', 'queuedUP', 'stalledDL', 'stalledUP'],
    stopped: ['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP'],
    checking: ['checkingDL', 'checkingUP', 'checkingResumeData'],
    errored: ['error', 'missingFiles'],
  };

  readonly statusItems = computed<FilterItem[]>(() => {
    this.languageChanged();
    const counts = this.countsByState();
    const sumStates = (...states: TorrentState[]) => {
      let total = 0;
      for (const s of states) total += counts[s] ?? 0;
      return total;
    };

    return [
      {
        key: 'downloading',
        label: this.translateService.instant('pages.main.status.downloading'),
        count: sumStates('downloading', 'forcedDL', 'queuedDL', 'metaDL', 'stalledDL'),
        icon: this.icon.faCircleDown,
      },
      {
        key: 'completed',
        label: this.translateService.instant('pages.main.status.completed'),
        count: sumStates(
          'uploading',
          'pausedUP',
          'stoppedUP',
          'queuedUP',
          'stalledUP',
          'checkingUP',
          'forcedUP',
        ),
        icon: this.icon.faCircleCheck,
      },
      {
        key: 'active',
        label: this.translateService.instant('pages.main.status.active'),
        count: sumStates(
          'downloading',
          'uploading',
          'forcedDL',
          'forcedUP',
          'metaDL',
          'moving',
          'allocating',
        ),
        icon: this.icon.faCirclePlay,
      },
      {
        key: 'inactive',
        label: this.translateService.instant('pages.main.status.inactive'),
        count: sumStates('queuedDL', 'queuedUP', 'stalledDL', 'stalledUP'),
        icon: this.icon.faCircleMinus,
      },
      {
        key: 'stopped',
        label: this.translateService.instant('pages.main.status.stopped'),
        count: sumStates('pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP'),
        icon: this.icon.faCircleStop,
      },
      {
        key: 'checking',
        label: this.translateService.instant('pages.main.status.checking'),
        count: sumStates('checkingDL', 'checkingUP', 'checkingResumeData'),
        icon: this.icon.faCircleNotch,
      },
      {
        key: 'errored',
        label: this.translateService.instant('pages.main.status.errored'),
        count: sumStates('error', 'missingFiles'),
        icon: this.icon.faCircleExclamation,
      },
    ];
  });

  readonly activeKey = computed<StatusKey>(() => {
    const active = this.filtersSig().states;

    if (active.size === 0) return 'all';

    const activeArr = Array.from(active).sort();
    const equals = (a: string[], b: string[]) =>
      a.length === b.length && a.every((v, i) => v === b[i]);

    for (const key of Object.keys(this.groups) as StatusKey[]) {
      const g = this.groups[key];
      if (g.length === 0) continue;

      const gSorted = [...g].sort();
      if (equals(activeArr, gSorted)) return key;
    }

    return 'all';
  });

  public setGroup(key: string): void {
    if (key === 'all') {
      this.filterService.clearStates();
      return;
    }
    const states = this.groups[key as StatusKey] ?? [];
    this.filterService.setStates(states);
  }

  readonly activeTrackerKey = computed(() => {
    const set = this.filtersSig().trackers;
    return set?.size === 0 ? 'all' : [...set][0];
  });

  readonly activeSavePathKey = computed(() => {
    const set = this.filtersSig().savePaths;
    return set?.size === 0 ? 'all' : [...set][0];
  });

  public clearTrackers(): void {
    this.filterService.clearTrackers();
  }

  public setTracker(key: string): void {
    this.filterService.setTrackers([key]);
  }

  public setTrackerGroup(key: string): void {
    if (key === 'all') {
      this.clearTrackers();
      return;
    }
    this.setTracker(key);
  }

  public clearSavePaths(): void {
    this.filterService.clearSavePaths();
  }

  public setSavePath(key: string): void {
    this.filterService.setSavePaths([key]);
  }

  public setSavePathGroup(key: string): void {
    if (key === 'all') {
      this.clearSavePaths();
      return;
    }
    this.setSavePath(key);
  }

  readonly trackersWithCounts = computed<FilterItem[]>(() => {
    const map = new Map<string, CountItem>();

    for (const t of this.store.torrentsArray()) {
      const trackers = getTrackers(t);
      if (trackers.length === 0) {
        const key = normalizeTracker(null);
        const prev = map.get(key);
        if (prev) prev.count++;
        else map.set(key, { key, label: key, count: 1 });
        continue;
      }
      for (const tracker of trackers) {
        const key = normalizeTracker(tracker);
        const prev = map.get(key);
        if (prev) prev.count++;
        else map.set(key, { key, label: key, count: 1 });
      }
    }

    if (map.get(normalizeTracker(null))?.count === 0) {
      map.delete(normalizeTracker(null));
    }

    return [...map.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((item) => ({ ...item, icon: this.icon.faLink }));
  });

  readonly savePathsWithCounts = computed<FilterItem[]>(() => {
    const map = new Map<string, CountItem>();

    for (const t of this.store.torrentsArray()) {
      const key = (t.save_path ?? '').trim() || '(none)';
      const prev = map.get(key);
      if (prev) prev.count++;
      else map.set(key, { key, label: key, count: 1 });
    }

    return [...map.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((item) => ({ ...item, icon: this.icon.faFolderOpen }));
  });

  readonly categoriesWithCounts = computed<FilterItem[]>(() => {
    const torrents = this.store.torrentsArray();
    const categories = this.store.categoriesMap();
    const counts = new Map<string, number>();

    for (const t of torrents) {
      if (t.category) {
        counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
      }
    }

    const allCategoryNames = new Set([...categories.keys(), ...counts.keys()]);
    const result: FilterItem[] = [];

    allCategoryNames.forEach((name) => {
      result.push({
        key: name,
        label: name,
        count: counts.get(name) ?? 0,
        icon: this.icon.faFolderTree,
      });
    });

    return result.sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly tagsWithCounts = computed<FilterItem[]>(() => {
    const torrents = this.store.torrentsArray();
    const allTags = this.store.tagsSet();
    const counts = new Map<string, number>();

    for (const t of torrents) {
      if (t.tags) {
        const tags = t.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
        for (const tag of tags) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
    }

    const allTagNames = new Set([...allTags, ...counts.keys()]);
    const result: FilterItem[] = [];

    allTagNames.forEach((name) => {
      result.push({
        key: name,
        label: name,
        count: counts.get(name) ?? 0,
        icon: this.icon.faTags,
      });
    });

    return result.sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly activeCategoryKey = computed(() => {
    const set = this.filtersSig().categories;
    return set?.size === 0 ? 'all' : [...set][0];
  });

  readonly activeTagKey = computed(() => {
    const set = this.filtersSig().tags;
    return set?.size === 0 ? 'all' : [...set][0];
  });

  public clearCategories(): void {
    this.filterService.clearCategories();
  }

  public setCategory(key: string): void {
    this.filterService.setCategories([key]);
  }

  public setCategoryGroup(key: string): void {
    if (key === 'all') {
      this.clearCategories();
      return;
    }
    this.setCategory(key);
  }

  public clearTags(): void {
    this.filterService.clearTags();
  }

  public clearAll(): void {
    this.filterService.resetAll();
  }

  public setTag(key: string): void {
    this.filterService.setTags([key]);
  }

  public setTagGroup(key: string): void {
    if (key === 'all') {
      this.clearTags();
      return;
    }
    this.setTag(key);
  }
}
