import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faArrowsRotate,
  faEllipsis,
  faEnvelope,
  faPen,
  faRss,
  faTrashCan,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { NgbDropdownModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { RssFeedRow, RssStoreService } from '../../../services/rss-store.service';

@Component({
  selector: 'app-rss-feed-list',
  imports: [FaIconComponent, NgbDropdownModule, NgbTooltipModule, TranslatePipe],
  templateUrl: './feed-list.html',
  styleUrl: './feed-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RssFeedList {
  private readonly store = inject(RssStoreService);
  private readonly commandBus = inject(CommandBusService);
  private readonly confirmService = inject(ConfirmService);

  public readonly icons = {
    faArrowsRotate,
    faEllipsis,
    faEnvelope,
    faPen,
    faRss,
    faTrashCan,
    faTriangleExclamation,
  };

  public readonly feeds = this.store.feedRows;
  public readonly totalUnread = this.store.totalUnread;
  public readonly selectedFeedPath = this.store.selectedFeedPath;

  public selectFeed(path: string | null): void {
    this.store.selectFeed(path);
  }

  public refresh(feed: RssFeedRow): void {
    void this.store.refresh(feed);
  }

  public rename(feed: RssFeedRow): void {
    this.commandBus.emit({ type: 'UI_RSS_RENAME_SUBSCRIPTION', feed });
  }

  public async remove(feed: RssFeedRow): Promise<void> {
    const confirmed = await this.confirmService.confirm(
      'pages.rss.remove-confirm.title',
      { text: 'pages.rss.remove-confirm.message', data: { name: feed.name } },
      'general.button.delete',
      undefined,
      undefined,
      faTrashCan,
    );
    if (confirmed) await this.store.removeFeed(feed);
  }
}
