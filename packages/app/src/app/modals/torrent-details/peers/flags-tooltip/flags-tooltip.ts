import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ITooltipAngularComp } from 'ag-grid-angular';
import { ITooltipParams } from 'ag-grid-community';
import { QbTorrentPeer } from '../../../../models/torrent.model';
import { PEER_FLAG_DEFINITIONS, PeerFlagDefinition } from './flags-tooltip.const';

@Component({
  selector: 'app-flags-tooltip',
  imports: [CommonModule],
  templateUrl: './flags-tooltip.html',
  styleUrl: './flags-tooltip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlagsTooltipComponent implements ITooltipAngularComp {
  public title = '';
  public activeFlags: PeerFlagDefinition[] = [];

  private readonly translateService = inject(TranslateService);

  public agInit(params: ITooltipParams<QbTorrentPeer>): void {
    this.title = this.translateService.instant(
      'components.modals.torrent-details.peers.flags-tooltip.title',
    );
    const raw = params.data?.flags ?? '';
    const active = new Set(raw.split(' ').filter(Boolean));
    this.activeFlags = PEER_FLAG_DEFINITIONS.filter((d) => active.has(d.flag)).map((d) => ({
      ...d,
      label: this.translateService.instant(d.label),
      description: this.translateService.instant(d.description),
    }));
  }
}
