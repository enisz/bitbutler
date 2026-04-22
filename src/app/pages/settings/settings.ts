import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnInit, signal, Type } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPencil } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { AutofocusDirective } from '../../directives/autofocus';
import { GuardableModal } from '../../models/guardable-modal.interface';
import { ConfirmService } from '../../services/confirm.service';
import { ToastService } from '../../services/toast.service';
import { SettingsStateService } from './settings-state.service';
import { SettingsTabComponent, SettingsTabId, Tab } from './settings.interface';

@Component({
  selector: 'app-settings',
  imports: [
    CommonModule,
    AutofocusDirective,
    TranslatePipe,
    BbSpinner,
    FontAwesomeModule,
    NgbTooltipModule,
  ],
  providers: [SettingsStateService],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit, GuardableModal {
  @Input() public tabToOpen: SettingsTabId = 'general';

  public readonly activeModal = inject(NgbActiveModal);
  public readonly stateService = inject(SettingsStateService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public activeTabId = signal<SettingsTabId>('general');
  public loadedComponents = signal<Map<SettingsTabId, Type<SettingsTabComponent>>>(new Map());

  public icon = { faPencil };

  public tabs: Tab[] = [
    {
      id: 'general',
      label: 'pages.settings.tab.general.title',
      loadComponent: () => import('./general/general').then((m) => m.General),
    },
    {
      id: 'server',
      label: 'pages.settings.tab.server.title',
      loadComponent: () => import('./server/server').then((m) => m.Server),
    },
    {
      id: 'torrent-list-grid',
      label: 'pages.settings.tab.torrent-list-grid.title',
      loadComponent: () =>
        import('./torrent-list-grid/torrent-list-grid').then((m) => m.TorrentListGrid),
    },
    {
      id: 'status-bar',
      label: 'pages.settings.tab.status-bar.title',
      loadComponent: () => import('./status-bar/status-bar').then((m) => m.StatusBar),
    },
  ];

  public async ngOnInit(): Promise<void> {
    this.activeTabId.set(this.tabToOpen);
    const results = await Promise.all(
      this.tabs.map((t) => t.loadComponent().then((c) => [t.id, c] as const)),
    );
    this.loadedComponents.set(new Map(results) as Map<SettingsTabId, Type<SettingsTabComponent>>);
  }

  public selectTab(tabId: SettingsTabId): void {
    this.activeTabId.set(tabId);
  }

  public async canDeactivate(): Promise<boolean> {
    if (!this.stateService.isDirty()) return true;

    const confirmed = await this.confirmService.confirm(
      'components.modals.guard.unsaved-title',
      'components.modals.guard.unsaved-message',
      'components.modals.guard.btn-leave',
      'components.modals.guard.btn-stay',
    );

    if (confirmed) this.stateService.resetDirty();

    return confirmed;
  }

  public async onSave(): Promise<void> {
    await this.stateService.saveAll();
    const message = await firstValueFrom(this.translateService.get('pages.settings.success.saved'));
    this.toastService.success(message);
  }
}
