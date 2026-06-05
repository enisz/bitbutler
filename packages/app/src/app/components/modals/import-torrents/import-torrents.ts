import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import type {
  BbePathMapping,
  ImportRestoreField,
  ImportStartMode,
  ImportStartPayload,
} from '@bitbutler/shared';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { ExportService } from '../../../services/export.service';
import { ServerStoreService } from '../../../services/server-store.service';

@Component({
  selector: 'app-import-torrents',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, FaIconComponent, DatePipe],
  templateUrl: './import-torrents.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportTorrents implements OnInit {
  readonly initialBbePath = input<string>();

  private readonly activeModal = inject(NgbActiveModal);
  readonly exportService = inject(ExportService);
  readonly serverStore = inject(ServerStoreService);

  importForm!: FormGroup;

  readonly restoreFieldKeys: ImportRestoreField[] = [
    'save_path',
    'category_tags',
    'speed_limits',
    'share_limits',
    'renames',
    'priorities',
    'auto_tmm',
    'sequential_download',
    'super_seeding',
    'first_last_piece_prio',
  ];

  readonly icons = { faMinus, faPlus };

  readonly phase = this.exportService.importPhase;
  readonly state = this.exportService.importState;
  readonly isLoading = computed(() => this.phase() === 'loading');
  readonly isReady = computed(() => this.phase() === 'ready');
  readonly isRunning = computed(() => this.phase() === 'running');
  readonly isDone = computed(() => this.phase() === 'done');
  readonly isError = computed(() => this.phase() === 'error');

  readonly progressPct = computed(() => {
    const s = this.state();
    return s.total > 0 ? Math.round((s.current / s.total) * 100) : 0;
  });

  readonly startModeHint = computed(() => {
    const mode = this.importForm?.get('startMode')?.value as ImportStartMode;
    const hints: Record<ImportStartMode, string> = {
      paused: 'components.modals.import-torrents.start-mode.hint.paused',
      active: 'components.modals.import-torrents.start-mode.hint.active',
      all: 'components.modals.import-torrents.start-mode.hint.all',
    };
    return hints[mode] ?? hints['active'];
  });

  readonly showPathRemap = computed(
    () => this.importForm?.get('restoreFields.save_path')?.value === true,
  );

  readonly metadata = computed(() => this.state().metadata);

  get pathMappings(): FormArray {
    return this.importForm.get('pathMappings') as FormArray;
  }

  ngOnInit(): void {
    this.importForm = new FormGroup({
      startMode: new FormControl<ImportStartMode>('active', { nonNullable: true }),
      restoreFields: new FormGroup({
        save_path: new FormControl(true, { nonNullable: true }),
        category_tags: new FormControl(true, { nonNullable: true }),
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
    });

    const bbePath = this.initialBbePath();
    if (bbePath) void this.loadBbe(bbePath);
  }

  createMappingRow(from = '', to = ''): FormGroup {
    return new FormGroup({
      from: new FormControl(from, { nonNullable: true }),
      to: new FormControl(to, { nonNullable: true }),
    });
  }

  addMapping(): void {
    this.pathMappings.push(this.createMappingRow());
  }

  removeMapping(i: number): void {
    if (this.pathMappings.length === 1) {
      this.pathMappings.at(0).reset({ from: '', to: '' });
    } else {
      this.pathMappings.removeAt(i);
    }
  }

  async browseToPath(i: number): Promise<void> {
    const dir = await window.bitbutler.electron.showOpenDialog();
    if (dir) this.pathMappings.at(i).get('to')?.setValue(dir);
  }

  async loadBbe(bbePath: string): Promise<void> {
    this.exportService.setImportLoading();
    try {
      const metadata = await window.bitbutler.export.readBbe({ path: bbePath });
      this.exportService.setImportReady(metadata);
    } catch (err) {
      this.exportService.setImportError((err as Error)?.message ?? String(err));
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

    const payload: ImportStartPayload = {
      serverId: this.serverStore.currentServer()?.id ?? '',
      bbePath: this.initialBbePath() ?? '',
      restoreFields,
      startMode: raw.startMode,
      pathMappings,
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
