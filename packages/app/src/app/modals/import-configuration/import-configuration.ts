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
import { faFileImport, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { ConfigurationService } from '../../services/configuration.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-import-configuration',
  standalone: true,
  imports: [TranslatePipe, BbBtnContent, BbSpinner],
  templateUrl: './import-configuration.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportConfiguration implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);
  private readonly configurationService = inject(ConfigurationService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public readonly bbcPath = input.required<string>();

  public readonly icons = { faFileImport, faXmark };

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

  public async ngOnInit(): Promise<void> {
    try {
      const metadata = await window.bitbutler.config.read({ path: this.bbcPath() });
      this.metadata.set(metadata);
      this.applySettings.set(metadata.hasSettings);
      this.selectedServerIds.set(new Set(metadata.servers.map((server) => server.id)));
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
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

    this.importing.set(true);
    try {
      const result = await window.bitbutler.config.importFile({
        path: this.bbcPath(),
        applySettings: this.applySettings(),
        serverIds: [...this.selectedServerIds()],
      });
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

  public cancel(): void {
    this.activeModal.dismiss();
  }
}
