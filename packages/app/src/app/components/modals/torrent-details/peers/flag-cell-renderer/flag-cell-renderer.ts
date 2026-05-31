import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { QbTorrentPeer } from '../../../../../models/torrent.model';

@Component({
  selector: 'app-flag-cell-renderer',
  imports: [CommonModule],
  templateUrl: './flag-cell-renderer.html',
  styleUrl: './flag-cell-renderer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlagCellRenderer implements ICellRendererAngularComp {
  public params!: ICellRendererParams<QbTorrentPeer, any, any>;

  public agInit(params: ICellRendererParams<QbTorrentPeer, any, any>): void {
    this.params = params;
  }

  public refresh(params: ICellRendererParams<any, any, any>): boolean {
    return true;
  }
}
