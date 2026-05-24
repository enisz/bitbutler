import { Component, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { TorrentDraft } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutofocusDirective } from '../../directives/autofocus';
import { RootFolderMode } from '../../models/add-torrent.model';
import type { SelectedTorrentInput } from '../../models/command.model';
import { HttpError } from '../../models/http.model';
import { AddTorrentSettingsService } from '../../services/add-torrent-settings.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { OpenFilesService, PendingAddTorrent } from '../../services/open-files.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { BbFileTree, FileTreeSaveEvent } from '../bb-file-tree/bb-file-tree';
import { BbPopover } from '../bb-popover/bb-popover';
import { CategorySelect } from '../category-select/category-select';
import { TorrentExists } from '../modals/torrent-exists/torrent-exists';
import { SavePathSelect } from '../save-path-select/save-path-select';
import { ShareLimit, ShareLimitValue } from '../share-limit/share-limit';
import { TagSelect } from '../tag-select/tag-select';
import { TransferLimit, TransferLimitValue } from '../transfer-limit/transfer-limit';

type AddTorrentFormValue = {
  file: string;
  magnetLinks: string;
  savepath: string | null;
  rename: string | null;
  paused: boolean;
  category: string | null;
  root_folder: RootFolderMode;
  tags: string[] | null;
  skip_checking: boolean;
  sequentialDownload: boolean;
  firstLastPiecePrio: boolean;
  transferRateLimits: TransferLimitValue | null;
  shareLimits: ShareLimitValue | null;
  autoTMM: boolean;
};

@Component({
  selector: 'app-add-torrent',
  imports: [
    ReactiveFormsModule,
    SavePathSelect,
    BbFileTree,
    TagSelect,
    CategorySelect,
    AutofocusDirective,
    BbPopover,
    FontAwesomeModule,
    NgSelectModule,
    TranslatePipe,
    ShareLimit,
    TransferLimit,
  ],
  templateUrl: './add-torrent.html',
  styleUrl: './add-torrent.scss',
})
export class AddTorrent implements OnInit {
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.handleCancel();
  }
  public readonly activeModal = inject(NgbActiveModal);
  private readonly modalService = inject(NgbModal);

  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly addTorrentSettings = inject(AddTorrentSettingsService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly qbService = inject(QbService);
  private readonly openFilesService = inject(OpenFilesService);
  private readonly translateService = inject(TranslateService);

  public pending = this.openFilesService.pendingDrafts;
  public queueCount = computed(() => this.pending().length);
  public currentDraftNumber = computed(() => this.initialQueueCount() - this.queueCount() + 1);

  public manualDraft = signal<TorrentDraft | null>(null);
  public inputMode = signal<'file' | 'link'>('file');
  public showTree = signal(false);
  public treeInEditMode = signal(false);
  private savedFileState: FileTreeSaveEvent | null = null;

  private selectedTorrentFile = signal<SelectedTorrentInput | null>(null);
  public initialQueueCount = signal(0);
  public isSubmitting = signal(false);
  private loadedDraftIdentifier = signal<string | null>(null);

  faExclamationTriangle = faExclamationTriangle;

  public addForm = new FormGroup({
    file: new FormControl<string>('', { nonNullable: true }),
    magnetLinks: new FormControl<string>('', { nonNullable: true }),
    savepath: new FormControl<string | null>(null),
    rename: new FormControl<string | null>(null, [Validators.required, this.noSlashValidator()]),
    paused: new FormControl<boolean>(false, { nonNullable: true }),
    category: new FormControl<string | null>(null),
    root_folder: new FormControl<RootFolderMode>('unset', { nonNullable: true }),
    tags: new FormControl<string[] | null>(null),
    skip_checking: new FormControl<boolean>(false, { nonNullable: true }),
    sequentialDownload: new FormControl<boolean>(false, { nonNullable: true }),
    firstLastPiecePrio: new FormControl<boolean>(false, { nonNullable: true }),
    transferRateLimits: new FormControl<TransferLimitValue | null>(null),
    shareLimits: new FormControl<ShareLimitValue | null>(null),
    autoTMM: new FormControl<boolean>(false, { nonNullable: true }),
  });

  public rootFolderOptions = [
    {
      value: 'unset',
      label: this.translateService.instant(
        'components.add-torrent.add-form.root-folder.option.default',
      ),
    },
    {
      value: 'true',
      label: this.translateService.instant(
        'components.add-torrent.add-form.root-folder.option.create-root-folder',
      ),
    },
    {
      value: 'false',
      label: this.translateService.instant(
        'components.add-torrent.add-form.root-folder.option.do-not-create-root-folder',
      ),
    },
  ];

  private noSlashValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? '').trim();
      return value.includes('/') || value.includes('\\') ? { noSlash: true } : null;
    };
  }

  public effectiveDraft = computed(() => this.manualDraft() ?? this.pending()?.[0]?.draft);

  constructor() {
    effect(() => {
      if (this.inputMode() === 'link') return;

      const pending = this.pending();
      if (pending.length > this.initialQueueCount()) {
        this.initialQueueCount.set(pending.length);
      }

      const first = pending[0];
      if (!first) {
        if (this.initialQueueCount() > 0) this.activeModal.close(true);
        return;
      }
      this.loadDraft(first, 'input');
    });
  }

  public async ngOnInit(): Promise<void> {
    const settings = (await this.addTorrentSettings.load()) as any;
    const serverId = this.serverStoreService.currentServerId();

    if (!settings.savepath && serverId) {
      try {
        const prefs = await this.qbService.getAppPreferences(serverId);
        settings.savepath = prefs.save_path;
      } catch (err) {
        console.error(AddTorrent.name, `ngOnInit`, `Failed to get app preferences`, err);
      }
    }

    for (const [k, v] of Object.entries(settings)) {
      const ctrl = this.addForm.get(k);
      if (ctrl && !ctrl.dirty) {
        if (k === 'tags' && typeof v === 'string') {
          ctrl.patchValue(
            v.split(',').map((t) => t.trim()),
            { emitEvent: false },
          );
        } else {
          ctrl.patchValue(v as any, { emitEvent: false });
        }
      }
    }
  }

  public handleCancel(): void {
    if (this.queueCount() > 0) {
      this.openFilesService.consumeCurrentDraft();
    } else {
      this.activeModal.dismiss();
    }
  }

  public onTreeSaved(event: FileTreeSaveEvent): void {
    this.savedFileState = event;
  }

  public async handleSubmit(event: SubmitEvent | PointerEvent): Promise<void> {
    event.preventDefault();

    if (!this.canSubmit()) return;

    const serverId = this.serverStoreService.currentServerId();

    if (!serverId) {
      this.addForm.setErrors({ noServerSelected: true });
      return;
    }

    const raw = this.addForm.getRawValue() as AddTorrentFormValue;

    const sharedOptions = {
      savepath: raw.savepath?.trim() || undefined,
      rename: raw.rename?.trim() || undefined,
      category: raw.category?.trim() || undefined,
      tags: raw.tags?.join(',') || undefined,
      paused: raw.paused ? 'true' : 'false',
      skip_checking: raw.skip_checking ? 'true' : 'false',
      sequentialDownload: raw.sequentialDownload ? 'true' : 'false',
      firstLastPiecePrio: raw.firstLastPiecePrio ? 'true' : 'false',
      autoTMM: raw.autoTMM ? 'true' : 'false',
      root_folder: raw.root_folder === 'unset' ? undefined : raw.root_folder,
      upLimit:
        raw.transferRateLimits?.uploadLimit != null
          ? String(Math.round(raw.transferRateLimits.uploadLimit * 1024))
          : undefined,
      dlLimit:
        raw.transferRateLimits?.downloadLimit != null
          ? String(Math.round(raw.transferRateLimits.downloadLimit * 1024))
          : undefined,
      ratioLimit:
        raw.shareLimits?.ratioLimit != null ? String(raw.shareLimits.ratioLimit) : undefined,
      seedingTimeLimit:
        raw.shareLimits?.seedingTimeLimit != null
          ? String(raw.shareLimits.seedingTimeLimit)
          : undefined,
    };

    this.isSubmitting.set(true);
    try {
      if (this.inputMode() === 'link') {
        await window.bitbutler.qb.torrentsAdd({
          id: serverId,
          urls: this.getMagnetLinks(),
          torrents: [],
          options: sharedOptions,
        });
      } else {
        const selectedFile = this.selectedTorrentFile()!;
        await window.bitbutler.qb.torrentsAdd({
          id: serverId,
          torrents: [selectedFile],
          options: sharedOptions,
        });

        const state = this.savedFileState;
        const hasTreeCustomizations =
          state != null &&
          (state.renames.length > 0 || state.files.some((f) => (f.priority ?? 1) !== 1));
        const inactiveLimit = raw.shareLimits?.inactiveSeedingTimeLimit ?? null;
        const needsInactivePost = inactiveLimit !== null && inactiveLimit !== -2;
        if (hasTreeCustomizations || needsInactivePost) {
          await this.tryRenameContentAfterAdd(serverId, raw.shareLimits);
        }
      }

      await this.addTorrentSettings.save({
        savepath: raw.savepath,
        paused: raw.paused,
        category: raw.category,
        tags: raw.tags?.join(',') || null,
        root_folder: raw.root_folder,
        skip_checking: raw.skip_checking,
        sequentialDownload: raw.sequentialDownload,
        firstLastPiecePrio: raw.firstLastPiecePrio,
        autoTMM: raw.autoTMM,
        transferRateLimits: raw.transferRateLimits,
        shareLimits: raw.shareLimits,
      });

      if (this.inputMode() === 'link') {
        this.activeModal.close(true);
      } else {
        const originalPath = this.effectiveDraft()?.originalPath;
        if (originalPath) {
          const generalSettings = await this.generalSettingsService.load();
          if (generalSettings.behavior.deleteTorrentFile) {
            await window.bitbutler.torrent.deleteFile({ path: originalPath });
          }
        }
        this.openFilesService.consumeCurrentDraft();
      }
    } catch (e) {
      console.error(AddTorrent.name, 'handleSubmit', '[AddTorrent] qb add failed', e);
      this.addForm.setErrors({ addFailed: true });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  public canSubmit(): boolean {
    if (this.inputMode() === 'link') {
      return (
        !this.isSubmitting() &&
        !this.treeInEditMode() &&
        this.getMagnetLinks().length > 0 &&
        this.addForm.valid
      );
    }
    return (
      this.addForm.valid &&
      !this.isSubmitting() &&
      this.selectedTorrentFile() !== null &&
      !this.treeInEditMode()
    );
  }

  public switchInputMode(mode: 'file' | 'link'): void {
    this.inputMode.set(mode);
    if (mode === 'link') {
      this.selectedTorrentFile.set(null);
      this.addForm.controls.file.disable();
      this.addForm.controls.rename.removeValidators(Validators.required);
      this.addForm.controls.rename.updateValueAndValidity();
      this.showTree.set(false);
    } else {
      this.addForm.controls.magnetLinks.setValue('', { emitEvent: false });
      this.addForm.controls.file.enable();
      this.addForm.controls.rename.addValidators(Validators.required);
      this.addForm.controls.rename.updateValueAndValidity();
    }
  }

  private getMagnetLinks(): string[] {
    return (this.addForm.controls.magnetLinks.value ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  public async handleFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const fileList = input.files;
    if (!fileList || fileList.length === 0) return;

    this.initialQueueCount.set(0);
    this.loadedDraftIdentifier.set(null);

    const file = fileList[0];
    const filePath = ((file as any).path as string | undefined)?.trim();

    let torrent: SelectedTorrentInput;
    if (filePath) {
      torrent = { name: file.name, path: filePath };
    } else {
      const buf = await file.arrayBuffer();
      torrent = { name: file.name, bytes: Array.from(new Uint8Array(buf)) };
    }

    try {
      const draft =
        'path' in torrent
          ? await window.bitbutler.torrent.parse({ source: 'manual', path: torrent.path })
          : await window.bitbutler.torrent.parse({
              source: 'manual',
              originalName: torrent.name,
              bytes: torrent.bytes,
            });
      this.openFilesService.pendingDrafts.set([{ draft, selected: torrent }]);
    } catch (e) {
      console.error(AddTorrent.name, 'handleFileSelected', 'manual parse failed:', e);
    } finally {
      input.value = '';
    }
  }

  private isAlreadyInList(draft: TorrentDraft): boolean {
    const hash = draft?.torrent?.infoHashV1?.toLowerCase();
    if (!hash) return false;

    return this.torrentStoreService.torrentsArray().some((t) => t.hash?.toLowerCase() === hash);
  }

  private loadDraft(pending: PendingAddTorrent, _source: 'input' | 'manual'): void {
    const draft = pending.draft;
    const identifier = draft.torrent?.infoHashV1 ?? draft.originalPath;

    if (identifier && this.loadedDraftIdentifier() === identifier) {
      return;
    }
    this.loadedDraftIdentifier.set(identifier ?? null);

    const oldSettings = this.addForm.value;
    this.addForm.reset();
    this.addForm.patchValue(oldSettings);
    this.addForm.get('file')?.setErrors(null);
    this.manualDraft.set(null);
    this.savedFileState = null;

    if (!draft || draft.error) {
      this.showTree.set(false);
      return;
    }

    this.selectedTorrentFile.set(pending.selected);

    if (pending.selected.name) {
      this.addForm.controls.file.setValue(pending.selected.name, { emitEvent: false });
    } else if (draft.originalName) {
      this.addForm.controls.file.setValue(draft.originalName, { emitEvent: false });
    }

    if (this.isAlreadyInList(draft)) {
      const modalRef = this.modalService.open(TorrentExists, { centered: true });
      modalRef.componentInstance.hash = draft.torrent?.infoHashV1?.toLowerCase() ?? null;
      this.openFilesService.consumeCurrentDraft();
      return;
    }

    const suggested =
      draft.torrent?.name?.trim() ?? draft.originalName?.replace(/\.torrent$/i, '') ?? '';

    const renameCtrl = this.addForm.controls.rename;
    if (suggested && !renameCtrl.dirty) {
      renameCtrl.setValue(suggested, { emitEvent: false });
    }

    this.showTree.set(!!draft.torrent?.files?.length);
  }

  private async tryRenameContentAfterAdd(
    serverId: string,
    shareLimits?: ShareLimitValue | null,
  ): Promise<void> {
    const hash = this.effectiveDraft()?.torrent?.infoHashV1?.trim();
    if (!hash) return;

    const pollForTorrent = async (): Promise<void> => {
      const maxRetries = 10;
      const delay = 500;
      for (let i = 0; i < maxRetries; i++) {
        try {
          const contents = await this.qbService.torrentContents(serverId, hash, {
            suppressErrors: true,
          });
          if (contents && contents.length > 0) return;
        } catch (e) {
          if (!(e instanceof HttpError && e.status === 404)) throw e;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      throw new Error(`Torrent ${hash} not found after ${maxRetries * delay}ms`);
    };

    try {
      await pollForTorrent();

      for (const item of this.savedFileState?.renames ?? []) {
        await this.qbService.renameTorrentFile(serverId, hash, item.oldPath, item.newPath);
      }

      const savedFiles = this.savedFileState?.files ?? null;
      if (savedFiles) {
        const nonDefault = savedFiles.filter((f) => (f.priority ?? 1) !== 1);
        if (nonDefault.length > 0) {
          const contents = await this.qbService.torrentContents(serverId, hash);
          const pathToIndex = new Map(contents.map((c) => [c.name, c.index]));
          for (const f of nonDefault) {
            const index = pathToIndex.get(f.path);
            if (index !== undefined) {
              await this.qbService.setFilePriority(serverId, hash, [index], f.priority ?? 0);
            }
          }
        }
      }

      if (shareLimits != null) {
        const inactiveLimit = shareLimits.inactiveSeedingTimeLimit;
        if (inactiveLimit !== null && inactiveLimit !== -2) {
          await this.qbService.setShareLimits(
            serverId,
            [hash],
            shareLimits.ratioLimit ?? -2,
            shareLimits.seedingTimeLimit ?? -2,
            inactiveLimit,
          );
        }
      }
    } catch (error) {
      console.error(AddTorrent.name, 'tryRenameContentAfterAdd', error);
    }
  }
}
