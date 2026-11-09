import { ScrollingModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbProgress } from '../../../../components/bb-progress/bb-progress';
import { formatProgressPercent } from '../../../../components/bb-progress/format-progress-percent';
import { variantForTorrentState } from '../../../../components/bb-progress/torrent-state-variant';
import { LongPressDirective } from '../../../../directives/long-press';
import { Torrent } from '../../../../models/torrent.model';
import { formatBytes, formatBytesPerSec } from '../../../../pipes/format-bytes';
import { CommandBusService } from '../../../../services/command-bus.service';
import { FilterService } from '../../../../services/filter.service';
import { SelectionStoreService } from '../../../../services/selection-store.service';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import { PhoneListStateService } from '../phone-list-state.service';

export const CARD_ITEM_SIZE = 96;
export const ROW_ITEM_SIZE = 44;

/** qBittorrent reports this ETA when it cannot estimate one. */
const ETA_INFINITE = 8640000;

export type StateKind =
  | 'downloading'
  | 'seeding'
  | 'paused'
  | 'stalled'
  | 'queued'
  | 'checking'
  | 'error'
  | 'other';

export function stateKind(state: string): StateKind {
  switch (state) {
    case 'downloading':
    case 'forcedDL':
      return 'downloading';
    case 'uploading':
    case 'forcedUP':
    case 'stalledUP':
      return 'seeding';
    case 'pausedDL':
    case 'pausedUP':
    case 'stoppedDL':
    case 'stoppedUP':
      return 'paused';
    case 'stalledDL':
      return 'stalled';
    case 'queuedDL':
    case 'queuedUP':
      return 'queued';
    case 'checkingDL':
    case 'checkingUP':
    case 'checkingResumeData':
      return 'checking';
    case 'error':
    case 'missingFiles':
      return 'error';
    default:
      return 'other';
  }
}

export function etaLabel(torrent: Pick<Torrent, 'eta'>): string {
  const eta = torrent.eta ?? 0;
  if (eta >= ETA_INFINITE) return '∞';
  if (eta <= 0) return '';
  const days = Math.floor(eta / 86400);
  const hours = Math.floor((eta % 86400) / 3600);
  const minutes = Math.floor((eta % 3600) / 60);
  const seconds = eta % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

@Component({
  selector: 'app-torrent-card-list',
  imports: [ScrollingModule, TranslatePipe, FontAwesomeModule, BbProgress, LongPressDirective],
  templateUrl: './torrent-card-list.html',
  styleUrl: './torrent-card-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentCardList {
  private readonly listState = inject(PhoneListStateService);
  private readonly filterService = inject(FilterService);
  private readonly selectionStore = inject(SelectionStoreService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly commandBus = inject(CommandBusService);

  public readonly icons = { faCheck };

  public readonly items = this.listState.items;
  public readonly compact = this.listState.compact;
  public readonly itemSize = computed(() => (this.compact() ? ROW_ITEM_SIZE : CARD_ITEM_SIZE));
  public readonly isPrimed = this.torrentStore.isPrimed;
  public readonly totalCount = this.torrentStore.totalCount;
  public readonly hasSearch = computed(() => this.filterService.external().search.length > 0);

  public readonly selectionMode = computed(() => this.selectionStore.selected().length > 0);
  private readonly selectedSet = computed(() => new Set(this.selectionStore.selectedHashes()));

  // Torrents that vanish from the store (deleted elsewhere) must not stay selected, and the
  // selection must point at the newest torrent objects so the action menu reads fresh state.
  private readonly _pruneSelectionEffect = effect(() => {
    const all = this.torrentStore.torrentsMap();
    // Read untracked: this effect writes the selection, so tracking it would loop forever.
    const selected = untracked(() => this.selectionStore.selected());
    if (selected.length === 0) return;
    const hashes = selected.map((t) => t.hash).filter((hash) => all.has(hash));
    this.selectionStore.setByHashes(hashes);
  });

  public readonly trackByHash = (_index: number, torrent: Torrent): string => torrent.hash;

  public isSelected(hash: string): boolean {
    return this.selectedSet().has(hash);
  }

  public onTap(torrent: Torrent): void {
    if (this.selectionMode()) {
      this.toggle(torrent);
      return;
    }
    this.commandBus.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash: torrent.hash });
  }

  public onLongPress(torrent: Torrent): void {
    if (this.selectionMode()) {
      this.toggle(torrent);
      return;
    }
    this.selectionStore.set(torrent);
  }

  private toggle(torrent: Torrent): void {
    const current = this.selectionStore.selected();
    if (current.some((t) => t.hash === torrent.hash)) {
      this.selectionStore.set(current.filter((t) => t.hash !== torrent.hash));
    } else {
      this.selectionStore.set([...current, torrent]);
    }
  }

  protected kind(torrent: Torrent): StateKind {
    return stateKind(torrent.state);
  }

  protected variant(torrent: Torrent): string {
    return variantForTorrentState(torrent.state);
  }

  protected percent(torrent: Torrent): string {
    return formatProgressPercent(torrent.progress * 100);
  }

  protected size(torrent: Torrent): string {
    return formatBytes(torrent.size);
  }

  protected speed(value: number): string {
    return formatBytesPerSec(value);
  }

  protected eta(torrent: Torrent): string {
    return etaLabel(torrent);
  }

  protected ratio(torrent: Torrent): string {
    return (torrent.ratio ?? 0).toFixed(2);
  }
}
