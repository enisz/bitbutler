import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  computed,
  effect,
  inject,
  input,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  BbePathMapping,
  BbeTorrentEntry,
  ImportRestoreField,
  ImportStartMode,
  ImportStartPayload,
} from '@bitbutler/shared';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faFileImport,
  faForward,
  faMinus,
  faPause,
  faPlay,
  faPlus,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  FirstDataRenderedEvent,
  GetRowIdParams,
  GridOptions,
  GridState,
  IOverlayParams,
  RowClassParams,
  SelectionChangedEvent,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import {
  GRID_DARK_THEME,
  GRID_LIGHT_THEME,
  GRID_ROW_MUTED_CLASS,
  GRID_SHARED_OPTIONS,
} from '../../app.const';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../components/bb-popover/bb-popover';
import { BbProgress } from '../../components/bb-progress/bb-progress';
import { BooleanColumnFilter } from '../../components/column-filters/boolean-column-filter/boolean-column-filter';
import { RatioLimitColumnFilter } from '../../components/column-filters/ratio-limit-column-filter/ratio-limit-column-filter';
import {
  SetColumnFilter,
  SetColumnFilterParams,
  buildValueCounts,
} from '../../components/column-filters/set-column-filter/set-column-filter';
import { SizeColumnFilter } from '../../components/column-filters/size-column-filter/size-column-filter';
import { TextColumnFilter } from '../../components/column-filters/text-column-filter/text-column-filter';
import { TimeLimitColumnFilter } from '../../components/column-filters/time-limit-column-filter/time-limit-column-filter';
import { NoRowOverlay } from '../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { LocalTimestampPipe } from '../../pipes/local-timestamp-pipe';
import { ExportService } from '../../services/export.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ThemeService } from '../../services/theme.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { UiFormatService } from '../../services/ui-format.service';
import { setModalInput } from '../../utils/modal-input';

export type ImportRowStatus = 'pending' | 'duplicate' | 'imported' | 'failed' | 'skipped';
type ImportGridRow = BbeTorrentEntry & { importState: ImportRowStatus };

@Component({
  selector: 'app-import-torrents',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FaIconComponent,
    BbProgress,
    BbPopover,
    LocalTimestampPipe,
    NgbTooltip,
    BbBtnContent,
    AgGridAngular,
  ],
  templateUrl: './import-torrents.html',
  styleUrl: './import-torrents.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportTorrents implements OnInit {
  readonly initialBbePath = input<string>();

  private loadedBbePath = '';

  private readonly activeModal = inject(NgbActiveModal);
  private readonly modalService = inject(NgbModal);
  private readonly exportService = inject(ExportService);
  private readonly injector = inject(Injector);
  readonly serverStore = inject(ServerStoreService);
  private readonly themeService = inject(ThemeService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly uiFormatService = inject(UiFormatService);
  private readonly translateService = inject(TranslateService);

  importForm!: FormGroup;
  private startModeValue!: ReturnType<typeof toSignal<ImportStartMode>>;
  private savePathEnabled!: ReturnType<typeof toSignal<boolean>>;
  private categoriesEnabled!: ReturnType<typeof toSignal<boolean>>;

  readonly restoreFieldKeys: ImportRestoreField[] = [
    'save_path',
    'categories',
    'tags',
    'speed_limits',
    'share_limits',
    'renames',
    'priorities',
    'auto_tmm',
    'sequential_download',
    'super_seeding',
    'first_last_piece_prio',
  ];

  private readonly legacyUnsupportedFields: ImportRestoreField[] = ['renames', 'priorities'];

  isLegacyUnsupported(field: ImportRestoreField): boolean {
    return this.legacyUnsupportedFields.includes(field);
  }

  readonly icons = {
    faMinus,
    faPlus,
    faTriangleExclamation,
    faPause,
    faPlay,
    faForward,
    faFileImport,
    faXmark,
  };

  readonly phase = this.exportService.importPhase;
  readonly state = this.exportService.importState;
  readonly isLoading = computed(() => this.phase() === 'loading');
  readonly isReady = computed(() => this.phase() === 'ready');
  readonly isRunning = computed(() => this.phase() === 'running');
  readonly isDone = computed(() => this.phase() === 'done');
  readonly isError = computed(() => this.phase() === 'error');

  readonly progressPct = computed(() => {
    const s = this.state();
    return s.total > 0 ? s.current / s.total : 0;
  });

  readonly startModeHint = computed(() => {
    const mode = this.startModeValue?.() ?? 'active';
    const hints: Record<ImportStartMode, string> = {
      paused: 'components.modals.import-torrents.start-mode.hint.paused',
      active: 'components.modals.import-torrents.start-mode.hint.active',
      all: 'components.modals.import-torrents.start-mode.hint.all',
    };
    return hints[mode as ImportStartMode] ?? hints['active'];
  });

  readonly showPathRemap = computed(() => this.savePathEnabled?.() === true);

  readonly showCategoryPathMapping = computed(() => this.categoriesEnabled?.() === true);

  readonly metadata = computed(() => this.state().metadata);

  readonly exportTypePopoverDescription = computed(() =>
    this.translateService.instant(
      this.metadata()?.export_mode === 'full'
        ? 'components.modals.import-torrents.archive.popover.export-type.full-description'
        : 'components.modals.import-torrents.archive.popover.export-type.legacy-description',
    ),
  );

  readonly tagsCount = computed(() => this.metadata()?.tags?.length ?? 0);
  readonly categoriesCount = computed(() => Object.keys(this.metadata()?.categories ?? {}).length);

  readonly serverUrl = computed(() => {
    const s = this.serverStore.currentServer();
    return s ? `${s.protocol}://${s.host}:${s.port}` : '';
  });

  readonly theme = this.themeService.effectiveMode;
  readonly bbDark = GRID_DARK_THEME;
  readonly bbLight = GRID_LIGHT_THEME;

  readonly duplicateHashes = computed(() => {
    const current = new Set(
      Array.from(this.torrentStore.torrentsMap().keys()).map((h) => h.toLowerCase()),
    );
    return new Set(
      (this.metadata()?.torrents ?? [])
        .filter((t) => !t.failed && current.has(t.hash.toLowerCase()))
        .map((t) => t.hash.toLowerCase()),
    );
  });

  private readonly skippedAtStart = signal<Set<string>>(new Set());

  readonly importRows = computed<ImportGridRow[]>(() => {
    const dupes = this.duplicateHashes();
    const results = this.exportService.importState().results;
    const skipped = this.skippedAtStart();
    const importStarted = this.phase() === 'running' || this.phase() === 'done';
    return (this.metadata()?.torrents ?? []).map((entry) => {
      const hashLower = entry.hash.toLowerCase();
      let importState: ImportRowStatus;
      if (entry.failed) {
        importState = 'failed';
      } else if (results.has(hashLower)) {
        importState = results.get(hashLower)!;
      } else if (dupes.has(hashLower)) {
        importState = 'duplicate';
      } else if (importStarted && skipped.has(hashLower)) {
        importState = 'skipped';
      } else {
        importState = 'pending';
      }
      return { ...entry, importState };
    });
  });

  // The backend's `alreadyExisted` count (import:done) counts every hash in
  // skipHashes, which now also includes non-duplicate rows the user manually
  // deselected. Recompute the "already existed" count client-side from rows
  // still marked 'duplicate' once the import has finished, so a deliberately
  // skipped new torrent isn't mislabeled as pre-existing.
  readonly doneAlreadyExisted = computed(
    () => this.importRows().filter((r) => r.importState === 'duplicate').length,
  );

  readonly doneImported = computed(
    () => this.importRows().filter((r) => r.importState === 'imported').length,
  );

  readonly doneSkipped = computed(
    () => this.importRows().filter((r) => r.importState === 'skipped').length,
  );

  readonly defaultSelectedHashes = computed(() => {
    return new Set(
      this.importRows()
        .filter((r) => r.importState === 'pending')
        .map((r) => r.hash.toLowerCase()),
    );
  });

  readonly selectedHashes = signal<Set<string>>(new Set());

  private hasSeededSelection = false;

  private readonly seedSelectionEffect = effect(() => {
    if (this.phase() === 'ready' && !this.hasSeededSelection) {
      this.hasSeededSelection = true;
      this.selectedHashes.set(untracked(() => this.defaultSelectedHashes()));
    }
  });

  readonly importGridOptions: GridOptions<ImportGridRow> = {
    ...GRID_SHARED_OPTIONS,
    rowSelection: {
      mode: 'multiRow',
      checkboxes: true,
      headerCheckbox: true,
      enableClickSelection: false,
      isRowSelectable: (node) => !node.data?.failed,
    },
    getRowId: (params: GetRowIdParams<ImportGridRow>) => params.data.hash,
    rowClassRules: {
      'text-danger bg-danger-subtle': (params: RowClassParams<ImportGridRow>): boolean =>
        params.data?.importState === 'failed',
      [GRID_ROW_MUTED_CLASS]: (params: RowClassParams<ImportGridRow>): boolean =>
        !!params.data?.failed,
    },
    overlayComponentSelector: (params: IOverlayParams<ImportGridRow>) => {
      switch (params.overlayType) {
        case 'noMatchingRows':
          return {
            component: NoRowOverlay,
            params: {
              message: this.translateService.instant(
                'components.modals.import-torrents.grid.no-matching-rows.message',
              ),
            },
          };

        default:
          return undefined;
      }
    },
    initialState: this.getImportGridInitialState(),
    onSelectionChanged: (e: SelectionChangedEvent<ImportGridRow>) =>
      this.onImportSelectionChanged(e),
    onFirstDataRendered: (e: FirstDataRenderedEvent<ImportGridRow>) =>
      this.onImportFirstDataRendered(e),
  };

  readonly importColDefs: ColDef<ImportGridRow>[] = this.getImportColDefs();

  onImportSelectionChanged(e: SelectionChangedEvent<ImportGridRow>): void {
    this.selectedHashes.set(new Set(e.api.getSelectedRows().map((r) => r.hash.toLowerCase())));
  }

  onImportFirstDataRendered(e: FirstDataRenderedEvent<ImportGridRow>): void {
    const selected = this.selectedHashes();
    e.api.forEachNode((node) => node.setSelected(selected.has(node.data!.hash.toLowerCase())));
    e.api.autoSizeAllColumns();
  }

  private importStateLabel(state: ImportRowStatus | null | undefined): string {
    return state
      ? this.translateService.instant(
          'components.modals.import-torrents.grid.import-state.' + state,
        )
      : '';
  }

  private getImportGridInitialState(): GridState {
    const visibleStates: ImportRowStatus[] = ['pending', 'duplicate', 'failed', 'skipped'];
    return {
      filter: {
        filterModel: {
          importState: { values: visibleStates.map((s) => this.importStateLabel(s)) },
        },
      },
    };
  }

  private getImportColDefs(): ColDef<ImportGridRow>[] {
    const stateItems = computed(() => buildValueCounts(this.importRows(), (t) => t.state));
    const importStateItems = computed(() =>
      buildValueCounts(this.importRows(), (t) => this.importStateLabel(t.importState)),
    );

    return [
      {
        colId: 'importState',
        field: 'importState',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.import_state',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.import_state',
        ),
        valueFormatter: (params: ValueFormatterParams<ImportGridRow, ImportRowStatus>) =>
          this.importStateLabel(params.value),
        filterValueGetter: (params: ValueGetterParams<ImportGridRow>) =>
          this.importStateLabel(params.data?.importState),
        sortable: true,
        resizable: true,
        filter: SetColumnFilter,
        filterParams: {
          getItems: () => importStateItems(),
        } satisfies Partial<SetColumnFilterParams>,
      },
      {
        colId: 'name',
        field: 'name',
        tooltipField: 'name',
        width: 220,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.name',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.name',
        ),
        sortable: true,
        sort: 'asc',
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'save_path',
        field: 'save_path',
        tooltipField: 'save_path',
        width: 260,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.save_path',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.save_path',
        ),
        sortable: true,
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'category',
        field: 'category',
        tooltipField: 'category',
        width: 150,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.category',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.category',
        ),
        sortable: true,
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'tags',
        field: 'tags',
        width: 180,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.tags',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.tags',
        ),
        valueFormatter: (params: ValueFormatterParams<ImportGridRow, string[]>) =>
          (params.value ?? []).join(', '),
        filterValueGetter: (params: ValueGetterParams<ImportGridRow>) =>
          (params.data?.tags ?? []).join(', '),
        tooltipValueGetter: (params) => (params.data?.tags ?? []).join(', '),
        sortable: true,
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'dl_limit',
        field: 'dl_limit',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.dl_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.dl_limit',
        ),
        valueFormatter: this.uiFormatService.fileSizePerSecond,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: SizeColumnFilter,
      },
      {
        colId: 'up_limit',
        field: 'up_limit',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.up_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.up_limit',
        ),
        valueFormatter: this.uiFormatService.fileSizePerSecond,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: SizeColumnFilter,
      },
      {
        colId: 'ratio_limit',
        field: 'ratio_limit',
        width: 135,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.ratio_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.ratio_limit',
        ),
        valueFormatter: this.uiFormatService.ratioLimit,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: RatioLimitColumnFilter,
      },
      {
        colId: 'seeding_time_limit',
        field: 'seeding_time_limit',
        width: 165,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.seeding_time_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.seeding_time_limit',
        ),
        valueFormatter: this.uiFormatService.timeLimit,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: TimeLimitColumnFilter,
      },
      {
        colId: 'inactive_seeding_time_limit',
        field: 'inactive_seeding_time_limit',
        width: 195,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.inactive_seeding_time_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.inactive_seeding_time_limit',
        ),
        valueFormatter: this.uiFormatService.timeLimit,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: TimeLimitColumnFilter,
      },
      {
        colId: 'auto_tmm',
        field: 'auto_tmm',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.auto_tmm',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.auto_tmm',
        ),
        cellRenderer: 'agCheckboxCellRenderer',
        editable: false,
        sortable: true,
        resizable: true,
        filter: BooleanColumnFilter,
      },
      {
        colId: 'sequential_download',
        field: 'sequential_download',
        width: 170,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.sequential_download',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.sequential_download',
        ),
        cellRenderer: 'agCheckboxCellRenderer',
        editable: false,
        sortable: true,
        resizable: true,
        filter: BooleanColumnFilter,
      },
      {
        colId: 'super_seeding',
        field: 'super_seeding',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.super_seeding',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.super_seeding',
        ),
        cellRenderer: 'agCheckboxCellRenderer',
        editable: false,
        sortable: true,
        resizable: true,
        filter: BooleanColumnFilter,
      },
      {
        colId: 'first_last_piece_prio',
        field: 'first_last_piece_prio',
        width: 175,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.first_last_piece_prio',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.first_last_piece_prio',
        ),
        cellRenderer: 'agCheckboxCellRenderer',
        editable: false,
        sortable: true,
        resizable: true,
        filter: BooleanColumnFilter,
      },
      {
        colId: 'state',
        field: 'state',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.state',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.state',
        ),
        sortable: true,
        resizable: true,
        filter: SetColumnFilter,
        filterParams: { getItems: () => stateItems() } satisfies Partial<SetColumnFilterParams>,
      },
    ];
  }

  get pathMappings(): FormArray {
    return this.importForm.get('pathMappings') as FormArray;
  }

  get categoryPathMappings(): FormArray {
    return this.importForm.get('categoryPathMappings') as FormArray;
  }

  ngOnInit(): void {
    this.importForm = new FormGroup({
      startMode: new FormControl<ImportStartMode>('active', { nonNullable: true }),
      restoreFields: new FormGroup({
        save_path: new FormControl(true, { nonNullable: true }),
        categories: new FormControl(true, { nonNullable: true }),
        tags: new FormControl(true, { nonNullable: true }),
        speed_limits: new FormControl(true, { nonNullable: true }),
        share_limits: new FormControl(true, { nonNullable: true }),
        renames: new FormControl(true, { nonNullable: true }),
        priorities: new FormControl(true, { nonNullable: true }),
        auto_tmm: new FormControl(true, { nonNullable: true }),
        sequential_download: new FormControl(true, { nonNullable: true }),
        super_seeding: new FormControl(true, { nonNullable: true }),
        first_last_piece_prio: new FormControl(true, { nonNullable: true }),
      }),
      pathMappings: new FormArray([this.createMappingRow()]),
      categoryPathMappings: new FormArray([this.createMappingRow()]),
      overwriteCategories: new FormControl<boolean>(false, { nonNullable: true }),
    });

    const startModeControl = this.importForm.get('startMode')!;
    this.startModeValue = runInInjectionContext(this.injector, () =>
      toSignal(startModeControl.valueChanges, {
        initialValue: startModeControl.value as ImportStartMode,
      }),
    );

    const savePathControl = this.importForm.get('restoreFields.save_path')!;
    this.savePathEnabled = runInInjectionContext(this.injector, () =>
      toSignal(savePathControl.valueChanges, { initialValue: savePathControl.value as boolean }),
    );

    const categoriesControl = this.importForm.get('restoreFields.categories')!;
    this.categoriesEnabled = runInInjectionContext(this.injector, () =>
      toSignal(categoriesControl.valueChanges, {
        initialValue: categoriesControl.value as boolean,
      }),
    );

    const bbePath = this.initialBbePath();
    if (bbePath) void this.loadBbe(bbePath);
  }

  createMappingRow(from = '', to = ''): FormGroup {
    return new FormGroup({
      from: new FormControl(from, { nonNullable: true }),
      to: new FormControl(to, { nonNullable: true }),
    });
  }

  addMapping(array: FormArray): void {
    array.push(this.createMappingRow());
  }

  removeMapping(array: FormArray, i: number): void {
    if (array.length === 1) {
      array.at(0).reset({ from: '', to: '' });
    } else {
      array.removeAt(i);
    }
  }

  async openQbSettings(): Promise<void> {
    const { QbSettings } = await import('../qb-settings/qb-settings');
    const ref = this.modalService.open(QbSettings, {
      size: 'xl',
      centered: false,
      scrollable: true,
      beforeDismiss: () => ref.componentInstance.canDeactivate(),
    });
    setModalInput(ref, 'tabToOpen', 'storage');
    ref.result.catch(() => {});
  }

  async loadBbe(bbePath: string): Promise<void> {
    this.loadedBbePath = bbePath;
    this.exportService.setImportLoading();
    try {
      const metadata = await window.bitbutler.export.readBbe({ path: bbePath });
      this.exportService.setImportReady(metadata);
      this.applyExportModeConstraints(metadata.export_mode);
    } catch (err) {
      this.exportService.setImportError((err as Error)?.message ?? String(err));
    }
  }

  private applyExportModeConstraints(exportMode: 'full' | 'legacy'): void {
    const group = this.importForm.get('restoreFields');
    for (const field of this.legacyUnsupportedFields) {
      const ctrl = group?.get(field);
      if (!ctrl) continue;
      if (exportMode === 'legacy') {
        ctrl.setValue(false);
        ctrl.disable();
      } else {
        ctrl.enable();
      }
    }
  }

  startImport(): void {
    const raw = this.importForm.getRawValue();
    const restoreFields = (Object.entries(raw.restoreFields) as [ImportRestoreField, boolean][])
      .filter(([, v]) => v)
      .map(([k]) => k);

    const pathMappings: BbePathMapping[] = (
      raw.pathMappings as Array<{ from: string; to: string }>
    ).filter((r) => r.from.trim());

    const categoryPathMappings: BbePathMapping[] = (
      raw.categoryPathMappings as Array<{ from: string; to: string }>
    ).filter((r) => r.from.trim());

    const selected = this.selectedHashes();
    const skipHashes = this.importRows()
      .filter((r) => !r.failed && !selected.has(r.hash.toLowerCase()))
      .map((r) => r.hash.toLowerCase());
    this.skippedAtStart.set(new Set(skipHashes));

    const payload: ImportStartPayload = {
      serverId: this.serverStore.currentServer()?.id ?? '',
      bbePath: this.loadedBbePath || this.initialBbePath() || '',
      restoreFields,
      startMode: raw.startMode,
      pathMappings,
      restoreCategories: raw.restoreFields.categories,
      restoreTags: raw.restoreFields.tags,
      categoryPathMappings,
      overwriteCategories: raw.overwriteCategories,
      skipHashes,
    };

    this.exportService.startImport();
    window.bitbutler.export.importStart(payload);
  }

  cancelImport(): void {
    window.bitbutler.export.importCancel();
  }

  close(): void {
    this.exportService.resetImport();
    this.activeModal.dismiss();
  }
}
