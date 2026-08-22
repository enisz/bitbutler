import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { QbTorrentPeer } from '../../../../models/torrent.model';

@Component({
  selector: 'app-flag-cell-renderer',
  imports: [CommonModule],
  templateUrl: './flag-cell-renderer.html',
  styleUrl: './flag-cell-renderer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlagCellRenderer implements ICellRendererAngularComp {
  public params!: ICellRendererParams<QbTorrentPeer, QbTorrentPeer['country_code']>;

  public agInit(params: ICellRendererParams<QbTorrentPeer, QbTorrentPeer['country_code']>): void {
    this.params = params;
  }

  public refresh(
    _params: ICellRendererParams<QbTorrentPeer, QbTorrentPeer['country_code']>,
  ): boolean {
    return true;
  }
}
