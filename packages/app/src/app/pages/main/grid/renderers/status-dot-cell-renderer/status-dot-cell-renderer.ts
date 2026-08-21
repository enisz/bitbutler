import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { BbProgressVariant } from '../../../../../components/bb-progress/bb-progress.types';
import { variantForTorrentState } from '../../../../../components/bb-progress/torrent-state-variant';
import { Torrent } from '../../../../../models/torrent.model';

@Component({
  selector: 'app-status-dot-cell-renderer',
  standalone: true,
  templateUrl: './status-dot-cell-renderer.html',
  styleUrls: ['./status-dot-cell-renderer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusDotCellRenderer implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  public variant: BbProgressVariant = 'secondary';

  agInit(params: ICellRendererParams<Torrent>): void {
    this.updateData(params);
  }

  refresh(params: ICellRendererParams<Torrent>): boolean {
    this.updateData(params);
    return true;
  }

  private updateData(params: ICellRendererParams<Torrent>): void {
    const state = params.data?.state;
    this.variant = state ? variantForTorrentState(state) : 'secondary';
    this.cdr.markForCheck();
  }
}
