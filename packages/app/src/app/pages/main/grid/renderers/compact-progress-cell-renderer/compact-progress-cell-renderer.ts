import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { BbProgress } from '../../../../../components/bb-progress/bb-progress';
import { formatProgressPercent } from '../../../../../components/bb-progress/format-progress-percent';
import { Torrent } from '../../../../../models/torrent.model';

@Component({
  selector: 'app-compact-progress-cell-renderer',
  standalone: true,
  imports: [CommonModule, BbProgress],
  templateUrl: './compact-progress-cell-renderer.html',
  styleUrls: ['./compact-progress-cell-renderer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompactProgressCellRenderer implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  public progress = 0;
  public state: string | undefined = undefined;
  public percentText = formatProgressPercent(0);

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
    this.percentText = formatProgressPercent(this.progress * 100);

    this.cdr.markForCheck();
  }
}
