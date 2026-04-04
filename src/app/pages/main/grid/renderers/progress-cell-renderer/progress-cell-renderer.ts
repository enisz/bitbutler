import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { BbProgress } from '../../../../../components/bb-progress/bb-progress';
import { Torrent } from '../../../../../models/torrent.model';

@Component({
  selector: 'app-progress-cell-renderer',
  standalone: true,
  imports: [CommonModule, BbProgress],
  templateUrl: './progress-cell-renderer.html',
  styleUrls: ['./progress-cell-renderer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressCellRenderer implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  public progress = 0;
  public state: string | undefined = undefined;

  agInit(params: ICellRendererParams<Torrent>): void {
    this.updateData(params);
  }

  refresh(params: ICellRendererParams<Torrent>): boolean {
    this.updateData(params);
    return true;
  }

  private updateData(params: ICellRendererParams<Torrent>): void {
    const data = params.data;
    if (!data) return;

    this.progress = typeof params.value === 'number' ? params.value : (data.progress ?? 0);
    this.state = data.state;

    this.cdr.markForCheck();
  }
}
