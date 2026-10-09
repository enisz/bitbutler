import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faArrowsRotate,
  faCheckDouble,
  faChevronLeft,
  faGear,
  faMagnifyingGlass,
  faPlus,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { interval } from 'rxjs';
import { CommandBusService } from '../../services/command-bus.service';
import { RssStoreService } from '../../services/rss-store.service';
import { ServerStoreService } from '../../services/server-store.service';
import { RssArticleDetails } from './article-details/article-details';
import { RssArticleList } from './article-list/article-list';
import { RssFeedList } from './feed-list/feed-list';

const POLL_INTERVAL_MS = 30_000;
/** Matches the `max-width: 1920px` breakpoint in `styles/_toolbar-button.scss` where labels hide. */
const COMPACT_MAX_WIDTH = 1920;

type RssAction = { id: string; icon: IconDefinition; label: string; run: () => void };

@Component({
  selector: 'app-rss',
  imports: [
    FontAwesomeModule,
    NgbTooltipModule,
    TranslatePipe,
    RssFeedList,
    RssArticleList,
    RssArticleDetails,
  ],
  templateUrl: './rss.html',
  styleUrl: './rss.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rss {
  private readonly router = inject(Router);
  private readonly store = inject(RssStoreService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly commandBus = inject(CommandBusService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly icons = { faChevronLeft, faMagnifyingGlass, faXmark };
  public readonly filterText = this.store.filterText;
  public readonly processingEnabled = this.store.processingEnabled;
  public readonly compact = signal(window.innerWidth <= COMPACT_MAX_WIDTH);

  public readonly actions: RssAction[] = [
    {
      id: 'update-all',
      icon: faArrowsRotate,
      label: 'pages.rss.action.update-all',
      run: () => void this.store.refresh(),
    },
    {
      id: 'mark-all-read',
      icon: faCheckDouble,
      label: 'pages.rss.action.mark-all-read',
      run: () => void this.store.markAllRead(),
    },
    {
      id: 'add-subscription',
      icon: faPlus,
      label: 'pages.rss.action.add-subscription',
      run: () => this.commandBus.emit({ type: 'UI_RSS_ADD_SUBSCRIPTION' }),
    },
    {
      id: 'settings',
      icon: faGear,
      label: 'pages.rss.action.settings',
      run: () => this.commandBus.emit({ type: 'UI_OPEN_QB_SETTINGS', tabToOpen: 'rss' }),
    },
  ];

  constructor() {
    effect(() => {
      const serverId = this.serverStoreService.currentServerId();
      untracked(() => {
        this.store.reset();
        if (serverId) void this.store.open();
      });
    });

    interval(POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.store.load());

    this.destroyRef.onDestroy(() => this.store.reset());
  }

  @HostListener('window:resize')
  public onResize(): void {
    this.compact.set(window.innerWidth <= COMPACT_MAX_WIDTH);
  }

  public goBack(): void {
    void this.router.navigate(['/pages/torrent-list']);
  }

  public onFilterInput(event: Event): void {
    this.store.filterText.set((event.target as HTMLInputElement).value);
  }

  public clearFilter(): void {
    this.store.filterText.set('');
  }

  public enableProcessing(): void {
    void this.store.enableProcessing();
  }
}
