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
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { SavePathSelect } from '../../save-path-select/save-path-select';

@Component({
  selector: 'app-set-torrent-location',
  imports: [ReactiveFormsModule, SavePathSelect, NgbTooltip, TranslatePipe, TooltipOverflow],
  templateUrl: './set-torrent-location.html',
  styleUrl: './set-torrent-location.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetTorrentLocation implements OnInit {
  readonly torrent = input.required<Torrent>();
  readonly hashes = input<string[]>([]);

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly qbService = inject(QbService);
  public readonly activeModal = inject(NgbActiveModal);
  private readonly translateService = inject(TranslateService);
  public setLocationForm = new FormGroup({
    path: new FormControl<string | null>(null),
  });

  public readonly selected = computed(() => this.hashes().length);
  private defaultPath = signal<string>('');

  public async ngOnInit(): Promise<void> {
    this.setLocationForm.get('path')?.patchValue(this.torrent().save_path ?? null);

    const serverId = this.serverStoreService.currentServerId();
    if (serverId) {
      try {
        const prefs = await this.qbService.getAppPreferences(serverId);
        if (prefs.save_path) this.defaultPath.set(prefs.save_path);
      } catch {}
    }
  }

  public async handleSubmit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() ?? '';
    const newPath =
      this.setLocationForm.get('path')?.value || this.defaultPath() || this.torrent().save_path;

    if (!serverId) {
      console.error(SetTorrentLocation.name, 'handleSubmit', 'Failed to get server id');
      return;
    }

    if (!newPath) {
      console.error(SetTorrentLocation.name, 'handleSubmit', 'New path is invalid!');
      return;
    }

    try {
      await this.qbService.setTorrentLocation(serverId, this.hashes(), newPath);
      this.activeModal.close();
    } catch (error: any) {
      console.error(
        SetTorrentLocation.name,
        'handleSubmit',
        'Failed to set torrent location!',
        error,
      );
      this.toastService.danger(
        error.message,
        this.translateService.instant(
          'components.modals.set-torrent-location.error.failed-to-relocate',
        ),
      );
    }
  }

  public canSave(): boolean {
    return true;
  }
}
