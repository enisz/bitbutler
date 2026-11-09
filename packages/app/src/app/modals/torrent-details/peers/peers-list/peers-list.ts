import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { QbTorrentPeer } from '../../../../models/torrent.model';
import { formatBytesPerSec } from '../../../../pipes/format-bytes';

@Component({
  selector: 'app-peers-list',
  imports: [TranslatePipe],
  templateUrl: './peers-list.html',
  styleUrl: './peers-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeersList {
  public readonly peers = input<QbTorrentPeer[]>([]);
  public readonly loading = input(false);

  protected address(peer: QbTorrentPeer): string {
    return peer.ip.includes(':') ? `[${peer.ip}]:${peer.port}` : `${peer.ip}:${peer.port}`;
  }

  protected percent(peer: QbTorrentPeer): string {
    return `${Math.round(Math.max(0, Math.min(1, peer.progress)) * 100)}%`;
  }

  protected speed(value: number): string {
    return formatBytesPerSec(value);
  }

  protected trackById(_index: number, peer: QbTorrentPeer): string {
    return `${peer.ip}:${peer.port}`;
  }
}
