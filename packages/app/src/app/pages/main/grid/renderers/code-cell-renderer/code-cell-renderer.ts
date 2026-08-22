import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { Torrent } from '../../../../../models/torrent.model';

@Component({
  selector: 'app-code-cell-renderer',
  imports: [],
  templateUrl: './code-cell-renderer.html',
  styleUrl: './code-cell-renderer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeCellRenderer implements ICellRendererAngularComp {
  public value: string = '';

  agInit(params: ICellRendererParams<Torrent, string>): void {
    this.value = params.value ?? '';
  }
  refresh(params: ICellRendererParams<Torrent, string>): boolean {
    this.value = params.value ?? '';
    return true;
  }
}
