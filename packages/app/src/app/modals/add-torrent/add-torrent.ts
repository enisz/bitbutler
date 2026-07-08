import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectedTorrentInput, TorrentDraft } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCircleInfo,
  faCircleQuestion,
  faPlus,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { merge, scan } from 'rxjs';
import { INVALID_FILENAME_CHARS } from '../../app.const';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { FileTreeSaveEvent, FileTreeStats } from '../../components/bb-file-tree/bb-file-tree';
import { ShareLimitValue } from '../../components/share-limit/share-limit';
import { TransferLimitValue } from '../../components/transfer-limit/transfer-limit';
import { AutofocusDirective } from '../../directives/autofocus';
import { AddTorrentFormGroup, RootFolderMode } from '../../models/add-torrent.model';
import { HttpError } from '../../models/http.model';
import { AddTorrentSettingsService } from '../../services/add-torrent-settings.service';
import { CommandBusService } from '../../services/command-bus.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { OpenFilesService, PendingAddTorrent } from '../../services/open-files.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { AddTorrentFiles } from './files/files';
import { AddTorrentGeneral } from './general/general';
import { AddTorrentLimits } from './limits/limits';
import { AddTorrentOptions } from './options/options';

export type AddTorrentTabId = 'general' | 'options' | 'limits' | 'files';

interface AddTorrentTab {
  id: AddTorrentTabId;
  label: string;
}

@Component({
  selector: 'app-add-torrent',
  imports: [
    ReactiveFormsModule,
    AutofocusDirective,
    FontAwesomeModule,
    NgbTooltip,
    TranslatePipe,
    AddTorrentFiles,
    AddTorrentGeneral,
    AddTorrentLimits,
    AddTorrentOptions,
    BbBtnContent,
  ],
  templateUrl: './add-torrent.html',
  styleUrl: './add-torrent.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrent implements OnInit {
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.handleCancel();
  }
  public readonly activeModal = inject(NgbActiveModal);

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly addTorrentSettings = inject(AddTorrentSettingsService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly qbService = inject(QbService);
  private readonly openFilesService = inject(OpenFilesService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly translateService = inject(TranslateService);

  private readonly generalTab = viewChild(AddTorrentGeneral);

  public pending = this.openFilesService.pendingDrafts;
  public queueCount = computed(() => this.pending().length);
  public currentDraftNumber = computed(() => this.initialQueueCount() - this.queueCount() + 1);

  public manualDraft = signal<TorrentDraft | null>(null);
  public inputMode = signal<'file' | 'link'>('file');
  public showTree = signal(false);
  public treeInEditMode = signal(false);
  public fileStats = signal<FileTreeStats | null>(null);
  public freeSpace = signal<number>(0);
  private savedFileState: FileTreeSaveEvent | null = null;

  private selectedTorrentFile = signal<SelectedTorrentInput | null>(null);
  public initialQueueCount = signal(0);
  public isSubmitting = signal(false);
  private loadedDraftIdentifier = signal<string | null>(null);

  public icons = { faTriangleExclamation, faCircleQuestion, faCircleInfo, faPlus, faXmark };

  public activeTabId = signal<AddTorrentTabId>('general');

  public tabs: AddTorrentTab[] = [
    { id: 'general', label: 'components.add-torrent.tab.general.title' },
    { id: 'options', label: 'components.add-torrent.tab.options.title' },
    { id: 'limits', label: 'components.add-torrent.tab.limits.title' },
    { id: 'files', label: 'components.add-torrent.tab.files.title' },
  ];

  public addForm: AddTorrentFormGroup = new FormGroup({
    fileGroup: new FormGroup({
      file: new FormControl<string>('', { nonNullable: true }),
      rename: new FormControl<string | null>(null, [Validators.pattern(INVALID_FILENAME_CHARS)]),
    }),
    linkGroup: new FormGroup({
      magnetLinks: new FormControl<string>('', { nonNullable: true }),
      rename: new FormControl<string | null>(null, [Validators.pattern(INVALID_FILENAME_CHARS)]),
    }),
    savepath: new FormControl<string | null>(null),
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

  // Tracks every form status/value change as an incrementing counter so `tabIssues` always
  // recomputes - `statusChanges` alone does not emit a distinct value when the status string
  // stays the same (e.g. INVALID -> INVALID when the `required` error is replaced by `pattern`).
  private readonly formStatus = toSignal(
    merge(this.addForm.statusChanges, this.addForm.valueChanges).pipe(
      scan((count) => count + 1, 0),
    ),
    { initialValue: 0 },
  );

  public effectiveDraft = computed(() => this.manualDraft() ?? this.pending()?.[0]?.draft);

  public readonly tabIssues = computed<Partial<Record<AddTorrentTabId, string>>>(() => {
    this.formStatus(); // re-run when addForm validity changes
    const issues: Partial<Record<AddTorrentTabId, string>> = {};

    const activeRename =
      this.inputMode() === 'file'
        ? this.addForm.controls.fileGroup.controls.rename
        : this.addForm.controls.linkGroup.controls.rename;
    const renameErrors = activeRename.errors;
    const formErrors = this.addForm.errors;

    if (renameErrors?.['pattern']) {
      issues.general = this.translateService.instant(
        'components.add-torrent.tab.general.issue.invalid-fields',
      );
    } else if (formErrors?.['noServerSelected']) {
      issues.general = this.translateService.instant(
        'components.add-torrent.feedback.no-server-selected',
      );
    } else if (formErrors?.['addFailed']) {
      issues.general = this.translateService.instant('components.add-torrent.feedback.add-failed');
    }

    if (this.treeInEditMode()) {
      issues.files = this.translateService.instant(
        'components.add-torrent.tab.files.issue.edit-in-progress',
      );
    }

    return issues;
  });

  public readonly hasActiveWarnings = computed(() =>
    Object.values(this.tabIssues()).some((issue) => !!issue),
  );

  public readonly filesTabDisabledReason = computed<string | null>(() => {
    if (this.inputMode() === 'link') {
      return this.translateService.instant('components.add-torrent.tab.files.disabled.link-mode');
    }
    const draft = this.effectiveDraft();
    if (!this.showTree() || !draft?.torrent?.files?.length) {
      return this.translateService.instant('components.add-torrent.tab.files.disabled.no-files');
    }
    return null;
  });

  public readonly filesTabDisabled = computed(() => this.filesTabDisabledReason() !== null);

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

    effect(() => {
      if (this.activeTabId() === 'files' && this.filesTabDisabled()) {
        this.activeTabId.set('general');
      }
    });

    effect(() => {
      this.formStatus(); // re-run when addForm validity changes
      const activeRename =
        this.inputMode() === 'file'
          ? this.addForm.controls.fileGroup.controls.rename
          : this.addForm.controls.linkGroup.controls.rename;
      if (activeRename.invalid) {
        activeRename.markAsTouched();
      }
    });

    effect(() => {
      if (this.filesTabDisabled()) {
        this.fileStats.set(null);
      }
    });
  }

  public async ngOnInit(): Promise<void> {
    const settings = (await this.addTorrentSettings.load()) as any;

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

  public selectTab(tabId: AddTorrentTabId): void {
    this.activeTabId.set(tabId);
  }

  public async handleSubmit(event: SubmitEvent | PointerEvent): Promise<void> {
    event.preventDefault();

    if (!this.canSubmit()) return;

    const serverId = this.serverStoreService.currentServerId();

    if (!serverId) {
      this.addForm.setErrors({ noServerSelected: true });
      return;
    }

    if (!(await this.generalTab()?.ensureCategoryExists())) {
      return;
    }

    const raw = this.addForm.getRawValue();
    const rename = this.inputMode() === 'file' ? raw.fileGroup.rename : raw.linkGroup.rename;

    const sharedOptions = {
      savepath: raw.savepath?.trim() || undefined,
      rename: rename?.trim() || undefined,
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
      let parsed: { name?: string; status?: number } = {};
      try {
        const msg = String((e as Error)?.message ?? e);
        const idx = msg.indexOf('{');
        if (idx !== -1) parsed = JSON.parse(msg.slice(idx));
      } catch {}

      if (parsed.name === 'QbHttpError' && parsed.status === 409) {
        const draft = this.effectiveDraft();
        const hash = draft?.torrent?.infoHashV1?.toLowerCase() ?? null;
        this.commandBusService.emit({
          type: 'UI_TORRENT_EXISTS',
          hash,
          originalPath: draft?.originalPath ?? null,
        });
        this.openFilesService.consumeCurrentDraft();
      } else {
        console.error(AddTorrent.name, 'handleSubmit', '[AddTorrent] qb add failed', e);
        this.addForm.setErrors({ addFailed: true });
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  public canSubmit(): boolean {
    // Intentionally not `this.addForm.valid` - fileGroup/linkGroup are never disabled, so that
    // would require both groups valid and let an invalid inactive-mode rename block submission.
    if (this.hasActiveWarnings() || this.isSubmitting() || this.addForm.errors) return false;

    return this.inputMode() === 'link'
      ? this.addForm.controls.linkGroup.valid && this.getMagnetLinks().length > 0
      : this.addForm.controls.fileGroup.valid && this.selectedTorrentFile() !== null;
  }

  public switchInputMode(mode: 'file' | 'link'): void {
    this.inputMode.set(mode);
    if (this.treeInEditMode()) {
      this.treeInEditMode.set(false);
    }
  }

  public handleInputModeChange(mode: 'file' | 'link'): void {
    if (mode === this.inputMode()) return;
    this.switchInputMode(mode);
  }

  private getMagnetLinks(): string[] {
    return (this.addForm.controls.linkGroup.controls.magnetLinks.value ?? '')
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
    this.addForm.controls.fileGroup.controls.file.setErrors(null);
    this.manualDraft.set(null);
    this.savedFileState = null;

    if (!draft || draft.error) {
      this.showTree.set(false);
      return;
    }

    this.selectedTorrentFile.set(pending.selected);

    if (pending.selected.name) {
      this.addForm.controls.fileGroup.controls.file.setValue(pending.selected.name, {
        emitEvent: false,
      });
    } else if (draft.originalName) {
      this.addForm.controls.fileGroup.controls.file.setValue(draft.originalName, {
        emitEvent: false,
      });
    }

    const suggested =
      draft.torrent?.name?.trim() ?? draft.originalName?.replace(/\.torrent$/i, '') ?? '';

    const renameCtrl = this.addForm.controls.fileGroup.controls.rename;
    if (suggested && !renameCtrl.dirty) {
      renameCtrl.setValue(suggested, { emitEvent: false });
    }

    this.showTree.set(!!draft.torrent?.files?.length);

    const serverId = this.serverStoreService.currentServerId();
    if (serverId) {
      this.qbService.sync
        .maindata(serverId, 0)
        .then((data) => {
          if (data.server_state?.free_space_on_disk != null) {
            this.freeSpace.set(data.server_state.free_space_on_disk);
          }
        })
        .catch(() => {});
    }
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
          const contents = await this.qbService.torrents.files(serverId, hash, {
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
        await this.qbService.torrents.renameFile(serverId, hash, item.oldPath, item.newPath);
      }

      const savedFiles = this.savedFileState?.files ?? null;
      if (savedFiles) {
        const nonDefault = savedFiles.filter((f) => (f.priority ?? 1) !== 1);
        if (nonDefault.length > 0) {
          const contents = await this.qbService.torrents.files(serverId, hash);
          const pathToIndex = new Map(contents.map((c) => [c.name, c.index]));
          for (const f of nonDefault) {
            const index = pathToIndex.get(f.path);
            if (index !== undefined) {
              await this.qbService.torrents.filePrio(serverId, hash, [index], f.priority ?? 0);
            }
          }
        }
      }

      if (shareLimits != null) {
        const inactiveLimit = shareLimits.inactiveSeedingTimeLimit;
        if (inactiveLimit !== null && inactiveLimit !== -2) {
          await this.qbService.torrents.setShareLimits(
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
