import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { QbTorrentTracker, QbTrackerStatus } from '../../../../models/qbittorrent.model';

const STATUS_KEYS: Record<number, string> = {
  [QbTrackerStatus.Disabled]: 'components.modals.torrent-details.trackers.status.disabled',
  [QbTrackerStatus.NotContacted]: 'components.modals.torrent-details.trackers.status.not-contacted',
  [QbTrackerStatus.Working]: 'components.modals.torrent-details.trackers.status.working',
  [QbTrackerStatus.Updating]: 'components.modals.torrent-details.trackers.status.updating',
  [QbTrackerStatus.NotWorking]: 'components.modals.torrent-details.trackers.status.not-working',
};

@Component({
  selector: 'app-trackers-list',
  imports: [TranslatePipe],
  templateUrl: './trackers-list.html',
  styleUrl: './trackers-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackersList {
  public readonly trackers = input<QbTorrentTracker[]>([]);
  public readonly loading = input(false);

  protected statusKey(tracker: QbTorrentTracker): string {
    return STATUS_KEYS[tracker.status] ?? String(tracker.status);
  }

  protected isWorking(tracker: QbTorrentTracker): boolean {
    return tracker.status === QbTrackerStatus.Working;
  }

  protected isFailing(tracker: QbTorrentTracker): boolean {
    return tracker.status === QbTrackerStatus.NotWorking;
  }
}
