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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- retyped in issue #287 Task 5
  public params!: ICellRendererParams<QbTorrentPeer, any, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- retyped in issue #287 Task 5
  public agInit(params: ICellRendererParams<QbTorrentPeer, any, any>): void {
    this.params = params;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- retyped in issue #287 Task 5
  public refresh(_params: ICellRendererParams<any, any, any>): boolean {
    return true;
  }
}
