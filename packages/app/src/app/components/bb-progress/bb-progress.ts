import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BbProgressState, BbProgressVariant } from './bb-progress.types';
import { variantForTorrentState } from './torrent-state-variant';

@Component({
  selector: 'app-bb-progress',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './bb-progress.html',
  styleUrl: './bb-progress.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbProgress {
  readonly progress = input<number | undefined | null>();
  readonly variant = input<BbProgressVariant>('primary');
  readonly torrentState = input<string | undefined>();
  readonly mode = input<'normal' | 'compact'>('normal');
  /**
   * When true, `progress()` is already a 0-100 percentage and the 0-1
   * fraction auto-detection heuristic below is skipped. Needed for callers
   * (e.g. electron-updater download progress) whose percentage can validly
   * sit in (0, 1] - a value the heuristic would otherwise misread as a
   * fraction and inflate. Defaults to false to preserve existing behavior
   * for every other caller.
   */
  readonly rawPercent = input<boolean>(false);

  public readonly progressPercent = computed(() => {
    const p = this.progress() ?? 0;
    const normalized = !this.rawPercent() && p > 0 && p <= 1 ? p * 100 : p;
    const rounded = Math.round((normalized + Number.EPSILON) * 100) / 100;
    return Math.max(0, Math.min(100, rounded));
  });

  public readonly displayVariant = computed(() => {
    const state = this.torrentState();
    return state ? variantForTorrentState(state as BbProgressState) : this.variant();
  });
}
