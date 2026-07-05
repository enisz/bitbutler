import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../components/bb-popover/bb-popover';
import { SavePathSelect } from '../../components/save-path-select/save-path-select';
import { TooltipOverflow } from '../../directives/tooltip-overflow';
import { Torrent } from '../../models/torrent.model';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';

export type SetPathType = 'save' | 'download';

@Component({
  selector: 'app-set-path',
  imports: [
    ReactiveFormsModule,
    SavePathSelect,
    NgbTooltip,
    TranslatePipe,
    TooltipOverflow,
    BbBtnContent,
    BbPopover,
  ],
  templateUrl: './set-path.html',
  styleUrl: './set-path.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetPath implements OnInit {
  readonly torrent = input.required<Torrent>();
  readonly hashes = input<string[]>([]);
  readonly pathType = input.required<SetPathType>();

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
  public readonly defaultSavePath = signal<string>('');

  public async ngOnInit(): Promise<void> {
    const initialPath =
      this.pathType() === 'save' ? this.torrent().save_path : this.torrent().download_path;
    this.form.get('path')?.patchValue(initialPath || null);

    if (this.pathType() === 'save') {
      const serverId = this.serverStoreService.currentServerId();
      if (serverId) {
        try {
          const prefs = await this.qbService.app.preferences(serverId);
          if (prefs.save_path) this.defaultSavePath.set(prefs.save_path);
        } catch {}
      }
    }
  }

  public async handleSubmit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() ?? '';

    if (!serverId) {
      console.error(SetPath.name, 'handleSubmit', 'Failed to get server id');
      return;
    }

    if (this.pathType() === 'save') {
      const newPath =
        this.form.get('path')?.value || this.defaultSavePath() || this.torrent().save_path;

      if (!newPath) {
        console.error(SetPath.name, 'handleSubmit', 'New path is invalid!');
        return;
      }

      try {
        await this.qbService.torrents.setLocation(serverId, this.hashes(), newPath);
        this.activeModal.close();
      } catch (error: any) {
        console.error(SetPath.name, 'handleSubmit', 'Failed to set save path!', error);
        this.toastService.danger(
          error.message,
          this.translateService.instant('components.modals.set-path.error.save-failed'),
        );
      }
      return;
    }

    const newPath = this.form.get('path')?.value;

    if (!newPath) {
      this.activeModal.close();
      return;
    }

    try {
      await this.qbService.torrents.setDownloadPath(serverId, this.hashes(), newPath);
      this.activeModal.close();
    } catch (error: any) {
      console.error(SetPath.name, 'handleSubmit', 'Failed to set download path!', error);
      this.toastService.danger(
        error.message,
        this.translateService.instant('components.modals.set-path.error.download-failed'),
      );
    }
  }

  public canSave(): boolean {
    return true;
  }
}
