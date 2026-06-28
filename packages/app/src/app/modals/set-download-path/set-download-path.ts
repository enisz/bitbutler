import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { SavePathSelect } from '../../components/save-path-select/save-path-select';
import { TooltipOverflow } from '../../directives/tooltip-overflow';
import { Torrent } from '../../models/torrent.model';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-set-download-path',
  imports: [
    ReactiveFormsModule,
    SavePathSelect,
    NgbTooltip,
    TranslatePipe,
    TooltipOverflow,
    BbBtnContent,
  ],
  templateUrl: './set-download-path.html',
  styleUrl: './set-download-path.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetDownloadPath implements OnInit {
  readonly torrent = input.required<Torrent>();
  readonly hashes = input<string[]>([]);

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly qbService = inject(QbService);
  public readonly activeModal = inject(NgbActiveModal);
  private readonly translateService = inject(TranslateService);

  public icons = { faFloppyDisk, faXmark };

  public form = new FormGroup({
    path: new FormControl<string | null>(null),
  });

  public readonly selected = computed(() => this.hashes().length);

  public ngOnInit(): void {
    this.form.get('path')?.patchValue(this.torrent().download_path ?? null);
  }

  public async handleSubmit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() ?? '';
    const newPath = this.form.get('path')?.value || this.torrent().download_path;

    if (!serverId || !newPath) return;

    try {
      await this.qbService.torrents.setDownloadPath(serverId, this.hashes(), newPath);
      this.activeModal.close();
    } catch (error: any) {
      this.toastService.danger(
        error.message,
        this.translateService.instant('components.modals.set-download-path.error.failed-to-set'),
      );
    }
  }

  public canSave(): boolean {
    return true;
  }
}
