import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  computed,
  inject,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  BbeServerInfo,
  ExportCategoryScope,
  ExportScope,
  ExportStartPayload,
  ExportTagScope,
} from '@bitbutler/shared';
import { faFileExport, faFolderOpen, faRotate, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../components/bb-popover/bb-popover';
import { BbProgress } from '../../components/bb-progress/bb-progress';
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { AutofocusDirective } from '../../directives/autofocus';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { ExportService } from '../../services/export.service';
import { FilterService } from '../../services/filter.service';
import { SelectionStoreService } from '../../services/selection-store.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';

@Component({
  selector: 'app-export-torrents',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    DecimalPipe,
    FilesizePipe,
    BbProgress,
    BbPopover,
    BbSpinner,
    BbBtnContent,
    AutofocusDirective,
  ],
  templateUrl: './export-torrents.html',
  styleUrl: './export-torrents.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportTorrents implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);
  readonly exportService = inject(ExportService);
  private readonly filterService = inject(FilterService);
  private readonly selectionStore = inject(SelectionStoreService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly serverStore = inject(ServerStoreService);
  private readonly injector = inject(Injector);

  public readonly icons = {
    faFolderOpen,
    faFileExport,
    faXmark,
    faRotate,
  };

  exportForm!: FormGroup;

  private scopeValue!: ReturnType<typeof toSignal<ExportScope>>;
  private categoryScopeValue!: ReturnType<typeof toSignal<ExportCategoryScope>>;
  private tagScopeValue!: ReturnType<typeof toSignal<ExportTagScope>>;

  readonly serverInfo = signal<BbeServerInfo | null>(null);
  readonly serverInfoLoading = signal(true);
  readonly serverInfoError = signal<string | null>(null);

  readonly serverName = computed(() => this.serverStore.currentServer()?.name ?? '');
  readonly serverUrl = computed(() => {
    const s = this.serverStore.currentServer();
    return s ? `${s.protocol}://${s.host}:${s.port}` : '';
  });

  readonly allCount = computed(() => this.torrentStore.torrents().length);
  readonly filteredCount = computed(() => this.filterService.filtered().length);
  readonly selectedCount = computed(() => this.selectionStore.selected().length);
  readonly hasSelection = computed(() => this.selectedCount() > 0);
  readonly hasFiltered = computed(() => this.filteredCount() > 0);

  readonly exportedTorrents = computed(() => {
    switch (this.scopeValue?.()) {
      case 'selected':
        return this.selectionStore.selected();
      case 'filtered':
        return this.filterService.filtered();
      default:
        return this.torrentStore.torrents();
    }
  });

  readonly allCategoriesCount = computed(() => this.torrentStore.categoriesMap().size);
  readonly allTagsCount = computed(() => this.torrentStore.tagsSet().size);

  readonly assignedCategoriesCount = computed(() => {
    const categories = new Set<string>();
    for (const t of this.exportedTorrents()) {
      if (t.category) categories.add(t.category);
    }
    return categories.size;
  });

  readonly assignedTagsCount = computed(() => {
    const tags = new Set<string>();
    for (const t of this.exportedTorrents()) {
      for (const tag of t.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        tags.add(tag);
      }
    }
    return tags.size;
  });

  readonly scopeHint = computed(() => {
    const mode = this.scopeValue?.() ?? 'all';
    const hints: Record<ExportScope, string> = {
      all: 'components.modals.export-torrents.scope.hint.all',
      filtered: 'components.modals.export-torrents.scope.hint.filtered',
      selected: 'components.modals.export-torrents.scope.hint.selected',
    };
    return hints[mode] ?? hints['all'];
  });

  readonly categoryScopeHint = computed(() => {
    const mode = this.categoryScopeValue?.() ?? 'all';
    const hints: Record<ExportCategoryScope, string> = {
      all: 'components.modals.export-torrents.category-scope.hint.all',
      assigned: 'components.modals.export-torrents.category-scope.hint.assigned',
    };
    return hints[mode] ?? hints['all'];
  });

  readonly tagScopeHint = computed(() => {
    const mode = this.tagScopeValue?.() ?? 'all';
    const hints: Record<ExportTagScope, string> = {
      all: 'components.modals.export-torrents.tag-scope.hint.all',
      assigned: 'components.modals.export-torrents.tag-scope.hint.assigned',
    };
    return hints[mode] ?? hints['all'];
  });

  readonly phase = this.exportService.exportPhase;
  readonly state = this.exportService.exportState;

  readonly isRunning = computed(() => this.phase() === 'running');
  readonly isDone = computed(() => this.phase() === 'done');
  readonly isError = computed(() => this.phase() === 'error');

  readonly progressPct = computed(() => {
    const s = this.state();
    return s.total > 0 ? s.current / s.total : 0;
  });

  readonly exportedCount = computed(() => {
    const s = this.state();
    return s.total - s.skipped;
  });

  ngOnInit(): void {
    const serverId = this.serverStore.currentServer()?.id;

    void Promise.all([
      serverId ? window.bitbutler.export.getServerInfo(serverId) : Promise.resolve(null),
      window.bitbutler.electron.getDownloadsPath(),
    ])
      .then(([info, downloadsPath]) => {
        if (info) this.serverInfo.set(info);
        this.serverInfoLoading.set(false);
        if (downloadsPath) this.exportForm.get('destDir')?.setValue(downloadsPath);
      })
      .catch((err: unknown) => {
        this.serverInfoError.set((err as Error)?.message ?? String(err));
        this.serverInfoLoading.set(false);
      });

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const serverName = (this.serverStore.currentServer()?.name ?? 'export')
      .toLowerCase()
      .replace(/\s+/g, '-');

    this.exportForm = new FormGroup({
      scope: new FormControl<ExportScope>('all', { nonNullable: true }),
      categoryScope: new FormControl<ExportCategoryScope>('all', { nonNullable: true }),
      tagScope: new FormControl<ExportTagScope>('all', { nonNullable: true }),
      destDir: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      filename: new FormControl(`${serverName}-${dateStr}`, {
        nonNullable: true,
        validators: [Validators.required],
      }),
    });

    const scopeControl = this.exportForm.get('scope')!;
    this.scopeValue = runInInjectionContext(this.injector, () =>
      toSignal(scopeControl.valueChanges, { initialValue: scopeControl.value as ExportScope }),
    );

    const categoryScopeControl = this.exportForm.get('categoryScope')!;
    this.categoryScopeValue = runInInjectionContext(this.injector, () =>
      toSignal(categoryScopeControl.valueChanges, {
        initialValue: categoryScopeControl.value as ExportCategoryScope,
      }),
    );

    const tagScopeControl = this.exportForm.get('tagScope')!;
    this.tagScopeValue = runInInjectionContext(this.injector, () =>
      toSignal(tagScopeControl.valueChanges, {
        initialValue: tagScopeControl.value as ExportTagScope,
      }),
    );
  }

  async browseDestDir(): Promise<void> {
    const dir = await window.bitbutler.electron.showOpenDialog();
    if (dir) this.exportForm.get('destDir')?.setValue(dir);
  }

  startExport(): void {
    if (this.exportForm.invalid) return;
    const { scope, categoryScope, tagScope, destDir, filename } = this.exportForm.getRawValue();

    const hashes = this.exportedTorrents().map((t) => t.hash);

    const serverId = this.serverStore.currentServer()?.id ?? '';
    const serverName = this.serverStore.currentServer()?.name ?? '';
    const payload: ExportStartPayload = {
      serverId,
      serverName,
      scope,
      categoryScope,
      tagScope,
      hashes,
      destDir,
      filename,
    };

    this.exportService.startExport(hashes.length);
    window.bitbutler.export.start(payload);
  }

  cancelExport(): void {
    this.exportService.cancelExport();
  }

  showInFolder(): void {
    const p = this.state().doneEvent?.path;
    if (p) void window.bitbutler.electron.showItemInFolder(p);
  }

  close(): void {
    this.exportService.resetExport();
    this.activeModal.dismiss();
  }
}
