import { Clipboard } from '@angular/cdk/clipboard';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  Type,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowDown,
  faArrowDownUpAcrossLine,
  faAsterisk,
  faBullhorn,
  faChevronUp,
  faCopy,
  faFolder,
  faFolderOpen,
  faFolderTree,
  faForwardFast,
  faPause,
  faPenToSquare,
  faPlay,
  faRotate,
  faShare,
  faTags,
  faTrashCan,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbDropdownModule, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { filter } from 'rxjs';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { AutofocusDirective } from '../../directives/autofocus';
import { TooltipOverflow } from '../../directives/tooltip-overflow';
import { AppCommand, TorrentCommand } from '../../models/command.model';
import { GuardableModal } from '../../models/guardable-modal.interface';
import { Torrent } from '../../models/torrent.model';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ModalGuardService } from '../../services/modal-guard.service';
import { ToastService } from '../../services/toast.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { TorrentDetailsActionsService } from './torrent-details-actions.service';
import { TorrentDetailsDataService } from './torrent-details-data.service';
import { Tab, TorrentDetailTabComponent, TorrentDetailTabId } from './torrent-details.interface';

@Component({
  selector: 'app-torrent-details',
  standalone: true,
  imports: [
    CommonModule,
    BbSpinner,
    NgComponentOutlet,
    AutofocusDirective,
    TooltipOverflow,
    NgbTooltip,
    NgbDropdownModule,
    TranslatePipe,
    FontAwesomeModule,
    BbBtnContent,
    FilesizePipe,
    TimeagoPipe,
  ],
  providers: [ModalGuardService, TorrentDetailsDataService, TorrentDetailsActionsService],
  templateUrl: './torrent-details.html',
  styleUrl: './torrent-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentDetails implements OnInit, GuardableModal {
  readonly hash = input<string | null>(null);
  readonly tabToOpen = input<TorrentDetailTabId>('general');
  readonly context = input<Record<string, any>>({});

  public readonly activeModal = inject(NgbActiveModal);
  public readonly guardService = inject(ModalGuardService);
  public readonly dataService = inject(TorrentDetailsDataService);
  public readonly actionsService = inject(TorrentDetailsActionsService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly confirmService = inject(ConfirmService);
  private readonly clipboard = inject(Clipboard);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public readonly icon = {
    faArrowDownUpAcrossLine,
    faArrowDown,
    faAsterisk,
    faBullhorn,
    faChevronUp,
    faCopy,
    faFolder,
    faFolderOpen,
    faFolderTree,
    faForwardFast,
    faPause,
    faPenToSquare,
    faPlay,
    faRotate,
    faShare,
    faTags,
    faTrashCan,
    faXmark,
  };

  public readonly activeTabId = this.dataService.activeTabId;
  public loadedComponents = signal<Map<TorrentDetailTabId, Type<TorrentDetailTabComponent>>>(
    new Map(),
  );

  public torrent = computed<Torrent | null>(() => {
    if (!this.hash()) return null;
    return this.torrentStoreService.torrentsMap().get(this.hash()!) as Torrent;
  });

  public tabs: Tab[] = [
    {
      id: 'general',
      label: 'General',
      loadComponent: () => import('./general/general').then((m) => m.General),
    },
    {
      id: 'trackers',
      label: 'Trackers',
      loadComponent: () => import('./trackers/trackers').then((m) => m.Trackers),
    },
    {
      id: 'peers',
      label: 'Peers',
      loadComponent: () => import('./peers/peers').then((m) => m.Peers),
    },
    {
      id: 'content',
      label: 'Content',
      loadComponent: () => import('./content/content').then((m) => m.Content),
    },
  ];

  constructor() {
    this.commandBusService.commands$
      .pipe(
        filter(
          (command: AppCommand): command is { type: 'TORRENT_DELETED'; hash: string } =>
            command.type === 'TORRENT_DELETED',
        ),
        filter(
          (command: TorrentCommand) =>
            command.type === 'TORRENT_DELETED' && command.hash === this.hash(),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.dataService.stopAll();
        this.activeModal.close();
      });
  }

  public async ngOnInit(): Promise<void> {
    this.dataService.init(this.hash() ?? '', this.context());
    this.dataService.selectTab(this.tabToOpen());

    const results = await Promise.all(
      this.tabs.map((t) => t.loadComponent().then((c) => [t.id, c] as const)),
    );
    this.loadedComponents.set(
      new Map(results) as Map<TorrentDetailTabId, Type<TorrentDetailTabComponent>>,
    );
  }

  public selectTab(tabId: TorrentDetailTabId): void {
    this.dataService.selectTab(tabId);
  }

  public copyHash(): void {
    const hash = this.torrent()?.hash;
    if (!hash) return;

    const field = this.translateService.instant('components.modals.torrent-details.hash');
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.copied-to-clipboard',
        { field },
      ),
    );
    this.clipboard.copy(hash);
  }

  public async canDeactivate(): Promise<boolean> {
    if (!this.guardService.isDirty()) return true;

    const confirmed = await this.confirmService.confirm(
      'components.modals.guard.unsaved-title',
      'components.modals.guard.unsaved-message',
      'components.modals.guard.btn-leave',
      'components.modals.guard.btn-stay',
    );

    if (confirmed) this.guardService.isDirty.set(false);

    return confirmed;
  }
}
