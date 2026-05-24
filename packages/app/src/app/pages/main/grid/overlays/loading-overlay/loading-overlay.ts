import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ILoadingOverlayAngularComp } from 'ag-grid-angular';
import { ILoadingOverlayParams } from 'ag-grid-community';
import { BbSpinner } from '../../../../../components/bb-spinner/bb-spinner';
import { Torrent } from '../../../../../models/torrent.model';

type LoadingOverlayParams = ILoadingOverlayParams<Torrent, any> & {
  title?: string;
  message?: string;
};

@Component({
  selector: 'app-loading-overlay',
  imports: [BbSpinner],
  templateUrl: './loading-overlay.html',
  styleUrl: './loading-overlay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlay implements ILoadingOverlayAngularComp {
  public title = 'Loading…';
  public message = 'Fetching data from qBittorrent';

  agInit(params: LoadingOverlayParams): void {
    this.title = params?.title ?? this.title;
    this.message = params?.message ?? this.message;
  }

  refresh(params: LoadingOverlayParams): boolean {
    this.agInit(params);
    return true;
  }
}
