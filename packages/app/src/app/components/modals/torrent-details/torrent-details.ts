import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Component, Input, OnInit, Type, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPencil } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { AutofocusDirective } from '../../../directives/autofocus';
import { AppCommand, TorrentCommand } from '../../../models/command.model';
import { GuardableModal } from '../../../models/guardable-modal.interface';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { ModalGuardService } from '../../../services/modal-guard.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import { Tab, TorrentDetailTabComponent, TorrentDetailTabId } from './torrent-details.interface';

@Component({
  selector: 'app-torrent-details',
  standalone: true,
  imports: [
    CommonModule,
    BbSpinner,
    NgComponentOutlet,
    AutofocusDirective,
    NgbTooltip,
    TranslatePipe,
    FontAwesomeModule,
  ],
  providers: [ModalGuardService],
  templateUrl: './torrent-details.html',
  styleUrl: './torrent-details.scss',
})
export class TorrentDetails implements OnInit, GuardableModal {
  @Input() hash: string | null = null;
  @Input() public tabToOpen: TorrentDetailTabId = 'general';
  @Input() public context: Record<string, any> = {};

  public readonly activeModal = inject(NgbActiveModal);
  public readonly guardService = inject(ModalGuardService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly confirmService = inject(ConfirmService);

  public readonly icon = { faPencil };

  public activeTabId = signal<TorrentDetailTabId>('general');
  public loadedComponents = signal<Map<TorrentDetailTabId, Type<TorrentDetailTabComponent>>>(
    new Map(),
  );

  public torrent = computed<Torrent | null>(() => {
    if (!this.hash) return null;
    return this.torrentStoreService.torrentsMap().get(this.hash) as Torrent;
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
            command.type === 'TORRENT_DELETED' && command.hash === this.hash,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.activeModal.close());
  }

  public async ngOnInit(): Promise<void> {
    this.activeTabId.set(this.tabToOpen);
    const results = await Promise.all(
      this.tabs.map((t) => t.loadComponent().then((c) => [t.id, c] as const)),
    );
    this.loadedComponents.set(
      new Map(results) as Map<TorrentDetailTabId, Type<TorrentDetailTabComponent>>,
    );
  }

  public selectTab(tabId: TorrentDetailTabId): void {
    this.activeTabId.set(tabId);
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
