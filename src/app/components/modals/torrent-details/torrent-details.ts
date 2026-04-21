import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Component, computed, inject, Input, OnInit, signal, Type } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  private readonly commandBusService = inject(CommandBusService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly confirmService = inject(ConfirmService);
  private readonly guardService = inject(ModalGuardService);

  public activeTabId = signal<TorrentDetailTabId>('general');
  public loadedComponent = signal<Type<TorrentDetailTabComponent> | null>(null);

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

  public ngOnInit(): void {
    this.selectTab(this.tabToOpen);
  }

  public async canDeactivate(): Promise<boolean> {
    if (!this.guardService.isDirty()) return true;

    const confirmed = await this.confirmService.confirm(
      'components.modals.guard.unsaved-title',
      'components.modals.guard.unsaved-message',
      'components.modals.guard.btn-leave',
      'components.modals.guard.btn-stay',
    );

    if (confirmed) {
      this.guardService.isDirty.set(false);
    }

    return confirmed;
  }

  public async onDismiss(): Promise<void> {
    if (await this.canDeactivate()) this.activeModal.dismiss();
  }

  public async onClose(): Promise<void> {
    if (await this.canDeactivate()) this.activeModal.close();
  }

  public async selectTab(tabId: TorrentDetailTabId): Promise<void> {
    if (this.activeTabId() === tabId && this.loadedComponent() !== null) return;

    if (!(await this.canDeactivate())) return;

    this.activeTabId.set(tabId);
    this.loadedComponent.set(null);

    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) throw new Error(`Tab with id ${tabId} not found`);

    const component = await tab.loadComponent();
    this.loadedComponent.set(component);
  }
}
