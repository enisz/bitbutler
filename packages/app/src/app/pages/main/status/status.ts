import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowsSpin,
  faCircleCheck,
  faCircleDown,
  faCircleExclamation,
  faCircleMinus,
  faCirclePlay,
  faCircleStop,
  faEraser,
  faFolderOpen,
  faFolderTree,
  faHourglassHalf,
  faLink,
  faPlay,
  faTags,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { TorrentState } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { FilterService } from '../../../services/filter.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { getTrackers, normalizeTracker } from '../tracker.utils';
import { FilterGroupAction, FilterGroupComponent, FilterItem } from './filter-group/filter-group';

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
  imports: [CommonModule, FontAwesomeModule, FilterGroupComponent, TranslatePipe, BbBtnContent],
  templateUrl: './status.html',
  styleUrl: './status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Status {
  private readonly store = inject(TorrentStoreService);
  private readonly filterService = inject(FilterService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly translateService = inject(TranslateService);
  private readonly filtersSig = this.filterService.external;
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  private toggleKey(current: ReadonlySet<string>, key: string): Set<string> {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  private isStatusGroupActive(key: StatusKey, current: ReadonlySet<TorrentState>): boolean {
    const g = this.groups[key];
    return g.length > 0 && g.every((s) => current.has(s));
  }

  readonly totalCount = this.store.totalCount;
  readonly countsByState = this.store.countsByState;

  readonly categoriesAction = computed<FilterGroupAction>(() => {
    this.languageChanged();
    return {
      label: this.translateService.instant('general.button.manage'),
      action: () => this.commandBusService.emit({ type: 'UI_MANAGE_CATEGORIES' }),
    };
  });

  readonly tagsAction = computed<FilterGroupAction>(() => {
    this.languageChanged();
    return {
      label: this.translateService.instant('general.button.manage'),
      action: () => this.commandBusService.emit({ type: 'UI_MANAGE_TAGS' }),
    };
  });

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
    faCircleExclamation,
    faLink,
    faFolderOpen,
    faFolderTree,
    faTags,
    faArrowsSpin,
    faEraser,
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
        icon: this.icon.faArrowsSpin,
      },
      {
        key: 'errored',
        label: this.translateService.instant('pages.main.status.errored'),
        count: sumStates('error', 'missingFiles'),
        icon: this.icon.faCircleExclamation,
      },
    ];
  });

  readonly activeStatusKeys = computed<ReadonlySet<string>>(() => {
    const current = this.filtersSig().states;
    const keys = new Set<string>();
    for (const key of Object.keys(this.groups) as StatusKey[]) {
      if (this.isStatusGroupActive(key, current)) keys.add(key);
    }
    return keys;
  });

  public setGroup(key: string): void {
    if (key === 'all') {
      this.filterService.clearStates();
      return;
    }
    if (!(key in this.groups)) return;
    const nextKeys = this.toggleKey(this.activeStatusKeys(), key);
    const next = new Set<TorrentState>();
    for (const k of nextKeys) for (const s of this.groups[k as StatusKey]) next.add(s);
    this.filterService.setStates(next);
  }

  readonly activeTrackerKeys = computed<ReadonlySet<string>>(() => this.filtersSig().trackers);

  readonly activeSavePathKeys = computed<ReadonlySet<string>>(() => this.filtersSig().savePaths);

  public clearTrackers(): void {
    this.filterService.clearTrackers();
  }

  public setTrackerGroup(key: string): void {
    if (key === 'all') {
      this.clearTrackers();
      return;
    }
    this.filterService.setTrackers(this.toggleKey(this.filtersSig().trackers, key));
  }

  public clearSavePaths(): void {
    this.filterService.clearSavePaths();
  }

  public setSavePathGroup(key: string): void {
    if (key === 'all') {
      this.clearSavePaths();
      return;
    }
    this.filterService.setSavePaths(this.toggleKey(this.filtersSig().savePaths, key));
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

  readonly categoriesWithCounts = computed<FilterItem[]>(() =>
    this.store.categoriesWithCounts().map((item) => ({ ...item, icon: this.icon.faFolderTree })),
  );

  readonly tagsWithCounts = computed<FilterItem[]>(() =>
    this.store.tagsWithCounts().map((item) => ({ ...item, icon: this.icon.faTags })),
  );

  readonly activeCategoryKeys = computed<ReadonlySet<string>>(() => this.filtersSig().categories);

  readonly activeTagKeys = computed<ReadonlySet<string>>(() => this.filtersSig().tags);

  public clearCategories(): void {
    this.filterService.clearCategories();
  }

  public setCategoryGroup(key: string): void {
    if (key === 'all') {
      this.clearCategories();
      return;
    }
    this.filterService.setCategories(this.toggleKey(this.filtersSig().categories, key));
  }

  public clearTags(): void {
    this.filterService.clearTags();
  }

  public clearAll(): void {
    this.filterService.resetAll();
  }

  public setTagGroup(key: string): void {
    if (key === 'all') {
      this.clearTags();
      return;
    }
    this.filterService.setTags(this.toggleKey(this.filtersSig().tags, key));
  }
}
