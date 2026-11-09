import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  DEFAULT_MOBILE_LIST_SETTINGS,
  PHONE_SORT_KEYS,
  PhoneSortKey,
} from '../../../models/mobile-list-settings.model';
import { Torrent } from '../../../models/torrent.model';
import { FilterService } from '../../../services/filter.service';
import { MobileListSettingsService } from '../../../services/mobile-list-settings.service';

export { PHONE_SORT_KEYS };
export type { PhoneSortKey };

const NAME_COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base' });

@Injectable({ providedIn: 'root' })
export class PhoneListStateService {
  private readonly filterService = inject(FilterService);
  private readonly mobileSettingsService = inject(MobileListSettingsService);

  private readonly settings = toSignal(this.mobileSettingsService.asObservable(), {
    initialValue: DEFAULT_MOBILE_LIST_SETTINGS,
  });

  public readonly sortKey = computed(() => this.settings().sortKey);
  public readonly sortDesc = computed(() => this.settings().sortDesc);
  public readonly compact = computed(() => this.settings().compactRows);

  public readonly items = computed<Torrent[]>(() => {
    const key = this.sortKey();
    const dir = this.sortDesc() ? -1 : 1;
    const list = this.filterService.filtered().slice();
    const byHash = (a: Torrent, b: Torrent) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);

    if (key === 'name') {
      return list.sort((a, b) => {
        const cmp = NAME_COLLATOR.compare(String(a.name ?? ''), String(b.name ?? ''));
        return cmp !== 0 ? cmp * dir : byHash(a, b);
      });
    }

    return list.sort((a, b) => {
      const diff = (a[key] ?? 0) - (b[key] ?? 0);
      return diff !== 0 ? diff * dir : byHash(a, b);
    });
  });

  // Read-modify-write calls are chained so each one sees the previous one's saved result.
  private queue: Promise<unknown> = Promise.resolve();

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  public setSort(key: PhoneSortKey): Promise<void> {
    return this.enqueue(async () => {
      const current = await this.mobileSettingsService.load();
      const sortDesc = key === current.sortKey ? !current.sortDesc : key !== 'name';
      await this.mobileSettingsService.save({ ...current, sortKey: key, sortDesc });
    });
  }

  public setCompact(value: boolean): Promise<void> {
    return this.enqueue(async () => {
      const current = await this.mobileSettingsService.load();
      await this.mobileSettingsService.save({ ...current, compactRows: value });
    });
  }
}
