import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faEraser, faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { TagSelect } from '../../tag-select/tag-select';

@Component({
  selector: 'app-set-torrent-tags',
  imports: [
    ReactiveFormsModule,
    TagSelect,
    NgbTooltip,
    TranslatePipe,
    TooltipOverflow,
    BbBtnContent,
  ],
  templateUrl: './set-torrent-tags.html',
  styleUrl: './set-torrent-tags.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetTorrentTags implements OnInit {
  readonly torrent = input.required<Torrent>();
  readonly hashes = input<string[]>([]);

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly qbService = inject(QbService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  public readonly activeModal = inject(NgbActiveModal);

  public icons = { faEraser, faFloppyDisk, faXmark };

  public readonly selected = computed(() => this.hashes().length);
  public saving = signal(false);
  public setTorrentTagsForm = new FormGroup({
    tags: new FormControl([] as string[]),
  });
  private formStatus = signal({
    valid: this.setTorrentTagsForm.valid,
    dirty: this.setTorrentTagsForm.dirty,
  });
  public canSave = computed(
    () => this.formStatus().valid && this.formStatus().dirty && !this.saving(),
  );

  constructor() {
    this.setTorrentTagsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.formStatus.set({
        valid: this.setTorrentTagsForm.valid,
        dirty: this.setTorrentTagsForm.dirty,
      });
    });
  }

  public ngOnInit(): void {
    try {
      const initialTags = (this.torrent().tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      this.setTorrentTagsForm.get('tags')?.patchValue(initialTags, { emitEvent: false });
    } catch (err: any) {
      console.error(SetTorrentTags.name, 'ngOnInit', 'Failed to get torrent tags!', err);
    }
  }

  public hasClearableValue(): boolean {
    return (this.setTorrentTagsForm.controls.tags.value ?? []).length > 0;
  }

  public clear(): void {
    const control = this.setTorrentTagsForm.controls.tags;
    control.markAsDirty();
    control.setValue([]);
  }

  public async handleSubmit(): Promise<void> {
    this.saving.set(true);

    const newTagsValue = this.setTorrentTagsForm.get('tags')?.value || [];
    const serverId = this.serverStoreService.currentServerId() ?? '';
    const hashes = this.hashes();

    const initialTags = (this.torrent().tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const tagsToAdd = newTagsValue.filter((tag) => !initialTags.includes(tag));
    const tagsToRemove = initialTags.filter((tag) => !newTagsValue.includes(tag));

    try {
      if (tagsToAdd.length > 0) {
        await this.qbService.torrents.addTags(serverId, hashes, tagsToAdd);
      }

      if (tagsToRemove.length > 0) {
        await this.qbService.torrents.removeTags(serverId, hashes, tagsToRemove);
      }

      this.activeModal.close();
    } catch (error: any) {
      console.error(SetTorrentTags.name, 'handleSubmit', 'Failed to set torrent tags!', error);
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant('components.modals.set-torrent-tags.toast.set-failed-title'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
