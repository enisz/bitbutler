import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { variantForTorrentState } from '../../utils/torrent-state-variant';
import { BbProgressState, BbProgressVariant } from './bb-progress.types';

@Component({
  selector: 'app-bb-progress',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './bb-progress.html',
  styleUrl: './bb-progress.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbProgress {
  private readonly _rawProgress = signal(0);
  private readonly _manualVariant = signal<BbProgressVariant>('primary');
  private readonly _torrentState = signal<string | undefined>(undefined);

  @Input() set progress(val: number | undefined | null) {
    this._rawProgress.set(val ?? 0);
  }

  @Input() set variant(val: BbProgressVariant) {
    this._manualVariant.set(val);
  }

  @Input() set torrentState(val: string | undefined) {
    this._torrentState.set(val);
  }

  public readonly progressPercent = computed(() => {
    const p = this._rawProgress();
    const normalized = p > 0 && p <= 1 ? p * 100 : p;
    const rounded = Math.round((normalized + Number.EPSILON) * 100) / 100;
    return Math.max(0, Math.min(100, rounded));
  });

  public readonly displayVariant = computed(() => {
    const state = this._torrentState();
    return state ? variantForTorrentState(state as BbProgressState) : this._manualVariant();
  });
}
