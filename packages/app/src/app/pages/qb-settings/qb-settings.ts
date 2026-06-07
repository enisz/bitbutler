import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  Type,
  inject,
  input,
  signal,
} from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faAsterisk } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { AutofocusDirective } from '../../directives/autofocus';
import { GuardableModal } from '../../models/guardable-modal.interface';
import { ConfirmService } from '../../services/confirm.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { QbSettingsStateService } from './qb-settings-state.service';
import { QbSettingsTab, QbSettingsTabComponent, QbSettingsTabId } from './qb-settings.interface';

@Component({
  selector: 'app-qb-settings',
  imports: [
    CommonModule,
    AutofocusDirective,
    TranslatePipe,
    BbSpinner,
    FontAwesomeModule,
    NgbTooltipModule,
  ],
  providers: [QbSettingsStateService],
  templateUrl: './qb-settings.html',
  styleUrl: './qb-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QbSettings implements OnInit, GuardableModal {
  public readonly activeModal = inject(NgbActiveModal);
  public readonly stateService = inject(QbSettingsStateService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);

  public readonly tabToOpen = input<QbSettingsTabId>('bandwidth');

  public activeTabId = signal<QbSettingsTabId>('bandwidth');
  public loadedComponents = signal<Map<QbSettingsTabId, Type<QbSettingsTabComponent>>>(new Map());

  public icon = { faAsterisk };

  public tabs: QbSettingsTab[] = [
    {
      id: 'bandwidth',
      label: 'pages.qb-settings.tab.bandwidth.title',
      loadComponent: () => import('./bandwidth/bandwidth').then((m) => m.Bandwidth),
    },
    {
      id: 'storage',
      label: 'pages.qb-settings.tab.storage.title',
      loadComponent: () => import('./storage/storage').then((m) => m.Storage),
    },
    {
      id: 'queue-limits',
      label: 'pages.qb-settings.tab.queue-limits.title',
      loadComponent: () => import('./queue-limits/queue-limits').then((m) => m.QueueLimits),
    },
    {
      id: 'seeding-ratios',
      label: 'pages.qb-settings.tab.seeding-ratios.title',
      loadComponent: () => import('./seeding-ratios/seeding-ratios').then((m) => m.SeedingRatios),
    },
  ];

  public async ngOnInit(): Promise<void> {
    this.activeTabId.set(this.tabToOpen());

    const serverId = this.serverStoreService.currentServerId();
    if (serverId) {
      const prefs = await this.qbService.getAppPreferences(serverId);
      this.stateService.setPreferences(prefs);
    }

    const results = await Promise.all(
      this.tabs.map((t) => t.loadComponent().then((c) => [t.id, c] as const)),
    );
    this.loadedComponents.set(
      new Map(results) as Map<QbSettingsTabId, Type<QbSettingsTabComponent>>,
    );
  }

  public selectTab(tabId: QbSettingsTabId): void {
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
    try {
      await this.stateService.saveAll();
      const message = await firstValueFrom(
        this.translateService.get('pages.qb-settings.success.saved'),
      );
      this.toastService.success(message);
      this.activeModal.close();
    } catch {
      const message = await firstValueFrom(this.translateService.get('general.error.save-failed'));
      this.toastService.error(message);
    }
  }
}
