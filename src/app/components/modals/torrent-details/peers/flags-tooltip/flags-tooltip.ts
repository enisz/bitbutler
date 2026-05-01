import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ITooltipAngularComp } from 'ag-grid-angular';
import { ITooltipParams } from 'ag-grid-community';
import { QbTorrentPeer } from '../../../../../models/torrent.model';
import { PEER_FLAG_DEFINITIONS, PeerFlagDefinition } from './flags-tooltip.const';

@Component({
  selector: 'app-flags-tooltip',
  imports: [CommonModule],
  templateUrl: './flags-tooltip.html',
  styleUrl: './flags-tooltip.scss',
})
export class FlagsTooltipComponent implements ITooltipAngularComp {
  public activeFlags: PeerFlagDefinition[] = [];

  public agInit(params: ITooltipParams<QbTorrentPeer>): void {
    const raw = params.data?.flags ?? '';
    const active = new Set(raw.split(' ').filter(Boolean));
    this.activeFlags = PEER_FLAG_DEFINITIONS.filter((d) => active.has(d.flag));
  }
}
