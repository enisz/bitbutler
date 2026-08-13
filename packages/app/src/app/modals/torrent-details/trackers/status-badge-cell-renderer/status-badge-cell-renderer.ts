import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { QbTorrentTracker, QbTrackerStatus } from '../../../../models/qbittorrent.model';

type BadgeVariant = 'ok' | 'idle' | 'warn';

const BADGE_VARIANT: Record<QbTrackerStatus, BadgeVariant> = {
  [QbTrackerStatus.Disabled]: 'idle',
  [QbTrackerStatus.NotContacted]: 'idle',
  [QbTrackerStatus.Working]: 'ok',
  [QbTrackerStatus.Updating]: 'idle',
  [QbTrackerStatus.NotWorking]: 'warn',
};

@Component({
  selector: 'app-status-badge-cell-renderer',
  imports: [],
  templateUrl: './status-badge-cell-renderer.html',
  styleUrl: './status-badge-cell-renderer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeCellRenderer implements ICellRendererAngularComp {
  public params!: ICellRendererParams<QbTorrentTracker, QbTrackerStatus, any>;

  public agInit(params: ICellRendererParams<QbTorrentTracker, QbTrackerStatus, any>): void {
    this.params = params;
  }

  public refresh(): boolean {
    return true;
  }

  public get variant(): BadgeVariant {
    const status = this.params.value ?? QbTrackerStatus.Disabled;
    return BADGE_VARIANT[status] ?? 'idle';
  }

  public get label(): string {
    return this.params.valueFormatted ?? '';
  }
}
