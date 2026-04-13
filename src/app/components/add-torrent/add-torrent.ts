import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutofocusDirective } from '../../directives/autofocus';
import { RootFolderMode } from '../../models/add-torrent.model';
import type { SelectedTorrentInput } from '../../models/command.model';
import { HttpError } from '../../models/http.model';
import { TorrentDraft } from '../../models/torrent-draft.model';
import { QbTorrentContent } from '../../models/torrent.model';
import { AddTorrentSettingsService } from '../../services/add-torrent-settings.service';
import { OpenFilesService, PendingAddTorrent } from '../../services/open-files.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { TypeaheadService } from '../../services/typeahead.service';
import { BbFileTree, FileTreeSaveEvent } from '../bb-file-tree/bb-file-tree';
import { BbPopover } from '../bb-popover/bb-popover';
import { CategorySelect } from '../category-select/category-select';
import { TorrentExists } from '../modals/torrent-exists/torrent-exists';
import { TagSelect } from '../tag-select/tag-select';

type AddTorrentFormValue = {
  file: string;
  savepath: string | null;
  rename: string | null;
  paused: boolean;
  category: string | null;
  root_folder: RootFolderMode;
  tags: string[] | null;
  skip_checking: boolean;
  sequentialDownload: boolean;
  firstLastPiecePrio: boolean;
  upLimitKbps: number | null;
  dlLimitKbps: number | null;
  ratioLimit: number | null;
  seedingTimeLimit: number | null;
  autoTMM: boolean;
};

@Component({
  selector: 'app-add-torrent',
  imports: [
    ReactiveFormsModule,
    NgbTypeahead,
    BbFileTree,
    TagSelect,
    CategorySelect,
    AutofocusDirective,
    BbPopover,
    FontAwesomeModule,
    NgSelectModule,
    TranslatePipe,
  ],
  templateUrl: './add-torrent.html',
  styleUrl: './add-torrent.scss',
})
export class AddTorrent implements OnInit {
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.handleCancel();
  }
  @ViewChild('savePathControl') public savePathControl!: ElementRef;
  public readonly activeModal = inject(NgbActiveModal);
  private readonly modalService = inject(NgbModal);

  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly addTorrentSettings = inject(AddTorrentSettingsService);
  private readonly typeaheadService = inject(TypeaheadService);
  private readonly qbService = inject(QbService);
  private readonly openFilesService = inject(OpenFilesService);
  private readonly translateService = inject(TranslateService);

  public pending = this.openFilesService.pendingDrafts;
  public queueCount = computed(() => this.pending().length);
  public currentDraftNumber = computed(() => this.initialQueueCount() - this.queueCount() + 1);

  public manualDraft = signal<TorrentDraft | null>(null);
  public readonly searchSavePaths = this.typeaheadService.searchSavePaths;
  public showTree = signal(false);
  private savedFileState: FileTreeSaveEvent | null = null;

  private selectedTorrentFile = signal<SelectedTorrentInput | null>(null);
  public initialQueueCount = signal(0);
  public isSubmitting = signal(false);
  private loadedDraftIdentifier = signal<string | null>(null);

  faExclamationTriangle = faExclamationTriangle;

  public addForm = new FormGroup({
    file: new FormControl<string>('', { nonNullable: true }),
    savepath: new FormControl<string | null>(null, [Validators.required]),
    rename: new FormControl<string | null>(null, [Validators.required, this.noSlashValidator()]),
    paused: new FormControl<boolean>(false, { nonNullable: true }),
    category: new FormControl<string | null>(null),
    root_folder: new FormControl<RootFolderMode>('unset', { nonNullable: true }),
    tags: new FormControl<string[] | null>(null),
    skip_checking: new FormControl<boolean>(false, { nonNullable: true }),
    sequentialDownload: new FormControl<boolean>(false, { nonNullable: true }),
    firstLastPiecePrio: new FormControl<boolean>(false, { nonNullable: true }),
    upLimitKbps: new FormControl<number | null>(null),
    dlLimitKbps: new FormControl<number | null>(null),
    ratioLimit: new FormControl<number | null>(null),
    seedingTimeLimit: new FormControl<number | null>(null),
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

    const selectedFile = this.selectedTorrentFile();
    if (!selectedFile) return;

    const serverId = this.serverStoreService.currentServerId();

    if (!serverId) {
      this.addForm.setErrors({ noServerSelected: true });
      return;
    }

    const raw = this.addForm.getRawValue() as AddTorrentFormValue;

    const payload = {
      id: serverId,
      torrents: [selectedFile],
      options: {
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
        upLimit: raw.upLimitKbps != null ? String(Math.round(raw.upLimitKbps * 1024)) : undefined,
        dlLimit: raw.dlLimitKbps != null ? String(Math.round(raw.dlLimitKbps * 1024)) : undefined,
        ratioLimit: raw.ratioLimit != null ? String(raw.ratioLimit) : undefined,
        seedingTimeLimit: raw.seedingTimeLimit != null ? String(raw.seedingTimeLimit) : undefined,
      },
    };

    this.isSubmitting.set(true);
    try {
      await window.bitbutler.qb.torrentsAdd(payload);
      const desired = (raw.rename ?? '').trim();
      const state = this.savedFileState;
      const hasTreeCustomizations =
        state != null &&
        (state.renames.length > 0 || state.files.some((f) => (f.priority ?? 1) === 0));
      if (desired || hasTreeCustomizations) {
        await this.tryRenameContentAfterAdd(serverId, desired);
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
        upLimitKbps: raw.upLimitKbps,
        dlLimitKbps: raw.dlLimitKbps,
        ratioLimit: raw.ratioLimit,
        seedingTimeLimit: raw.seedingTimeLimit,
      });
      this.openFilesService.consumeCurrentDraft();
    } catch (e) {
      console.error(AddTorrent.name, 'handleSubmit', '[AddTorrent] qb add failed', e);
      this.addForm.setErrors({ addFailed: true });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  public canSubmit(): boolean {
    return this.addForm.valid && !this.isSubmitting() && this.selectedTorrentFile() !== null;
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
      this.activeModal.dismiss('Torrent already exists');
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

  private async tryRenameContentAfterAdd(serverId: string, desiredRaw: string): Promise<void> {
    const selectedFile = this.selectedTorrentFile();
    if (!selectedFile) return;

    const draft = this.effectiveDraft();
    const hash = draft?.torrent?.infoHashV1?.trim();
    if (!hash) return;

    const pollForTorrent = async (): Promise<QbTorrentContent[]> => {
      const maxRetries = 10;
      const delay = 500;
      for (let i = 0; i < maxRetries; i++) {
        try {
          const contents = await this.qbService.torrentContents(serverId, hash, {
            suppressErrors: true,
          });
          if (contents && contents.length > 0) {
            return contents;
          }
        } catch (e) {
          if (!(e instanceof HttpError && e.status === 404)) {
            console.error(
              AddTorrent.name,
              'tryRenameContentAfterAdd',
              `Unexpected error while polling for torrent ${hash}`,
              e,
            );
            throw e;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      throw new Error(
        `Torrent content not found for hash ${hash} after polling for ${maxRetries * delay}ms.`,
      );
    };

    try {
      const contents = await pollForTorrent();

      if (!contents || contents.length === 0) return;

      const isSingleFile = contents.length === 1 && !this.hasFolderPrefix(contents[0]?.name ?? '');

      const renames = this.savedFileState ? [...this.savedFileState.renames] : [];
      const savedFiles = this.savedFileState?.files ?? null;

      if (isSingleFile) {
        if (desiredRaw) {
          const oldName = (contents[0]?.name ?? '').trim();
          if (oldName) {
            const newName = this.buildSingleFileName(oldName, desiredRaw);
            if (newName && newName !== oldName) {
              await this.qbService.renameTorrentFile(serverId, hash, oldName, newName);
            }
          }
        }
      } else {
        if (desiredRaw) {
          const firstPath = (contents[0]?.name ?? '').trim();
          const root = this.getRootFolder(firstPath);
          if (root) {
            const newRoot = this.sanitizeFolderName(desiredRaw);
            if (newRoot && newRoot !== root) {
              await this.qbService.renameTorrentFolder(serverId, hash, root, newRoot);
              const oldPrefix = root + '/';
              const newPrefix = newRoot + '/';
              for (let i = 0; i < renames.length; i++) {
                renames[i] = {
                  ...renames[i],
                  oldPath: renames[i].oldPath.startsWith(oldPrefix)
                    ? newPrefix + renames[i].oldPath.slice(oldPrefix.length)
                    : renames[i].oldPath,
                  newPath: renames[i].newPath.startsWith(oldPrefix)
                    ? newPrefix + renames[i].newPath.slice(oldPrefix.length)
                    : renames[i].newPath,
                };
              }
            }
          }
        }
      }

      for (const item of renames) {
        if (item.type === 'folder') {
          await this.qbService.renameTorrentFolder(serverId, hash, item.oldPath, item.newPath);
        } else {
          await this.qbService.renameTorrentFile(serverId, hash, item.oldPath, item.newPath);
        }
      }

      if (savedFiles) {
        const skipped = savedFiles
          .map((f, i) => ({ index: i, priority: f.priority ?? 1 }))
          .filter((f) => f.priority === 0);
        for (const f of skipped) {
          await this.qbService.setFilePriority(serverId, hash, [f.index], 0);
        }
      }
    } catch (error) {
      console.error(
        AddTorrent.name,
        'tryRenameContentAfterAdd',
        `Failed to rename torrent content for hash ${hash}:`,
        error,
      );
    }
  }

  private hasFolderPrefix(path: string): boolean {
    return (path ?? '').includes('/');
  }

  private getRootFolder(path: string): string | null {
    const p = (path ?? '').trim();
    if (!p) return null;
    const idx = p.indexOf('/');
    if (idx <= 0) return null;
    return p.slice(0, idx);
  }

  private buildSingleFileName(oldName: string, desiredRaw: string): string {
    const desired = this.sanitizeFileName(desiredRaw);
    if (!desired) return '';

    const oldExt = this.getExtension(oldName);
    const desiredExt = this.getExtension(desired);

    if (!desiredExt && oldExt) {
      return desired + oldExt;
    }

    return desired;
  }

  private getExtension(name: string): string {
    const n = (name ?? '').trim();
    const i = n.lastIndexOf('.');
    if (i <= 0 || i === n.length - 1) return '';
    return n.slice(i);
  }

  private sanitizeFileName(input: string): string {
    return (input ?? '')
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
      .replace(/\s+$/g, '')
      .replace(/\.+$/g, '');
  }

  private sanitizeFolderName(input: string): string {
    const v = this.sanitizeFileName(input).replace(/\//g, '').replace(/\\/g, '');
    if (!v) return '';

    if (v === '.' || v === '..') return '';
    return v;
  }
}
