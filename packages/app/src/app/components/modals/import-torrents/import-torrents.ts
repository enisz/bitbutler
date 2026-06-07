import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  computed,
  inject,
  input,
  runInInjectionContext,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import type {
  BbePathMapping,
  ImportRestoreField,
  ImportStartMode,
  ImportStartPayload,
} from '@bitbutler/shared';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faMinus, faPlus, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { QbSettings } from '../../../pages/qb-settings/qb-settings';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { ExportService } from '../../../services/export.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { setModalInput } from '../../../utils/modal-input';
import { BbPopover } from '../../bb-popover/bb-popover';
import { BbProgress } from '../../bb-progress/bb-progress';

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
  ],
  templateUrl: './import-torrents.html',
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

  readonly icons = { faMinus, faPlus, faTriangleExclamation };

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

  readonly tagsCount = computed(() => this.metadata()?.tags?.length ?? 0);
  readonly categoriesCount = computed(() => Object.keys(this.metadata()?.categories ?? {}).length);

  readonly serverUrl = computed(() => {
    const s = this.serverStore.currentServer();
    return s ? `${s.protocol}://${s.host}:${s.port}` : '';
  });

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

  openQbSettings(): void {
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
