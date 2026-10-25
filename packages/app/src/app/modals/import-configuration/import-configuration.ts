import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { BbcMetadata } from '@bitbutler/shared';
import { faFileImport, faRightFromBracket, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { BbOptionText } from '../../directives/bb-option-text';
import { ConfigurationService } from '../../services/configuration.service';
import { ConfirmService } from '../../services/confirm.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-import-configuration',
  standalone: true,
  imports: [BbOptionText, TranslatePipe, BbBtnContent, BbSpinner],
  templateUrl: './import-configuration.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportConfiguration implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);
  private readonly configurationService = inject(ConfigurationService);
  private readonly confirmService = inject(ConfirmService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public readonly bbcPath = input.required<string>();
  /** Hides the application settings option, e.g. when opened from the server manager. */
  public readonly serversOnly = input(false);

  public readonly icons = { faFileImport, faXmark };

  public readonly currentServerId = this.serverStoreService.currentServerId;

  public readonly metadata = signal<BbcMetadata | null>(null);
  public readonly loading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly importing = signal(false);
  public readonly applySettings = signal(false);
  public readonly selectedServerIds = signal<ReadonlySet<string>>(new Set());

  public readonly canImport = computed(
    () =>
      this.metadata() !== null &&
      !this.importing() &&
      (this.applySettings() || this.selectedServerIds().size > 0),
  );

  // Restoring the server the user is logged in to invalidates the session.
  private readonly replacedCurrentServer = computed(() => {
    const id = this.currentServerId();
    return id !== null && this.selectedServerIds().has(id) ? id : null;
  });

  public async ngOnInit(): Promise<void> {
    try {
      const metadata = await window.bitbutler.config.read({ path: this.bbcPath() });
      this.metadata.set(metadata);
      this.applySettings.set(metadata.hasSettings && !this.serversOnly());
      this.selectedServerIds.set(new Set(metadata.servers.map((server) => server.id)));
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  public serverDetail(server: BbcMetadata['servers'][number]): string {
    const base = 'components.modals.import-configuration';
    const parts = [
      `${server.host}:${server.port}`,
      this.translateService.instant(`${base}.${server.exists ? 'badge-exists' : 'badge-new'}`),
    ];
    if (server.id === this.currentServerId()) {
      parts.push(this.translateService.instant(`${base}.badge-current`));
    }
    return parts.join(' - ');
  }

  public setApplySettings(value: boolean): void {
    this.applySettings.set(value);
  }

  public toggleServer(id: string): void {
    this.selectedServerIds.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  public async import(): Promise<void> {
    if (!this.canImport()) return;

    const replacedId = this.replacedCurrentServer();
    if (replacedId && !(await this.confirmLogout(replacedId))) return;

    this.importing.set(true);
    try {
      const result = await window.bitbutler.config.importFile({
        path: this.bbcPath(),
        applySettings: this.applySettings(),
        serverIds: [...this.selectedServerIds()],
      });
      // Only after the import succeeded, so a failure leaves the user connected.
      if (replacedId) await this.qbService.forceLogout(replacedId);
      this.activeModal.close();
      this.configurationService.finishImport(result);
    } catch (error) {
      this.toastService.danger(
        (error as Error).message,
        this.translateService.instant(
          'components.modals.import-configuration.toast.import-failed-title',
        ),
      );
    } finally {
      this.importing.set(false);
    }
  }

  private confirmLogout(serverId: string): Promise<boolean> {
    const server = this.serverStoreService.servers().find((s) => s.id === serverId);
    const base = 'components.modals.import-configuration';
    return this.confirmService.confirm(
      `${base}.logout-confirm.title`,
      {
        text: `${base}.logout-confirm.message`,
        data: { name: server?.name || server?.host || '' },
      },
      `${base}.button.restore-and-log-out`,
      undefined,
      undefined,
      faRightFromBracket,
    );
  }

  public cancel(): void {
    this.activeModal.dismiss();
  }
}
