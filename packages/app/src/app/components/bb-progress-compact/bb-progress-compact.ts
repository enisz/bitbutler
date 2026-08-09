import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BbProgressState, BbProgressVariant } from '../bb-progress/bb-progress.types';
import { variantForTorrentState } from '../bb-progress/torrent-state-variant';

@Component({
  selector: 'app-bb-progress-compact',
  standalone: true,
  imports: [],
  templateUrl: './bb-progress-compact.html',
  styleUrl: './bb-progress-compact.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbProgressCompact {
  readonly progress = input<number | undefined | null>();
  readonly variant = input<BbProgressVariant>('primary');
  readonly torrentState = input<string | undefined>();

  public readonly progressPercent = computed(() => {
    const p = this.progress() ?? 0;
    const normalized = p > 0 && p <= 1 ? p * 100 : p;
    const rounded = Math.round((normalized + Number.EPSILON) * 100) / 100;
    return Math.max(0, Math.min(100, rounded));
  });

  public readonly displayVariant = computed(() => {
    const state = this.torrentState();
    return state ? variantForTorrentState(state as BbProgressState) : this.variant();
  });
}
