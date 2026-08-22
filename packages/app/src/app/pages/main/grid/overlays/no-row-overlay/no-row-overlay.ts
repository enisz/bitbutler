import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { INoRowsOverlayAngularComp } from 'ag-grid-angular';
import { INoRowsOverlayParams } from 'ag-grid-community';
import { Torrent } from '../../../../../models/torrent.model';

type NoRowOverlayParams = INoRowsOverlayParams<Torrent> & {
  message?: string;
};

@Component({
  selector: 'app-no-row-overlay',
  imports: [TranslatePipe],
  templateUrl: './no-row-overlay.html',
  styleUrl: './no-row-overlay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoRowOverlay implements INoRowsOverlayAngularComp {
  public message = '';

  agInit(params: NoRowOverlayParams): void {
    this.message = params.message ?? '';
  }

  refresh(params: NoRowOverlayParams): boolean {
    this.message = params.message ?? '';
    return true;
  }
}
