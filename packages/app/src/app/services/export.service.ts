import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import type {
  BbeMetadata,
  ExportDoneEvent,
  ExportProgressEvent,
  ImportProgressEvent,
} from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from './toast.service';

export type ExportPhase = 'idle' | 'running' | 'done' | 'error';
export type ImportPhase = 'idle' | 'loading' | 'ready' | 'running' | 'done' | 'error';

export interface ExportState {
  phase: ExportPhase;
  current: number;
  total: number;
  name: string;
  skipped: number;
  doneEvent?: ExportDoneEvent;
  error?: string;
}

export interface ImportState {
  phase: ImportPhase;
  metadata?: BbeMetadata;
  current: number;
  total: number;
  name: string;
  failed: number;
  alreadyExisted: number;
  error?: string;
  results: Map<string, 'imported' | 'failed'>;
}

const EXPORT_IDLE: ExportState = { phase: 'idle', current: 0, total: 0, name: '', skipped: 0 };
const IMPORT_IDLE: ImportState = {
  phase: 'idle',
  current: 0,
  total: 0,
  name: '',
  failed: 0,
  alreadyExisted: 0,
  results: new Map(),
};

@Injectable({ providedIn: 'root' })
export class ExportService implements OnDestroy {
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  private readonly _export = signal<ExportState>(EXPORT_IDLE);
  private readonly _import = signal<ImportState>(IMPORT_IDLE);

  readonly exportPhase = computed(() => this._export().phase);
  readonly exportState = this._export.asReadonly();

  readonly importPhase = computed(() => this._import().phase);
  readonly importState = this._import.asReadonly();

  private readonly unsubscribers: Array<() => void> = [];

  constructor() {
    const api = window.bitbutler.export;

    this.unsubscribers.push(
      api.onProgress((e: ExportProgressEvent) =>
        this._export.update((s) => (s.phase === 'running' ? { ...s, ...e } : s)),
      ),
      api.onDone((e: ExportDoneEvent) => {
        if (this._export().phase !== 'running') return;
        this._export.update((s) => ({
          ...s,
          phase: 'done',
          doneEvent: e,
          current: e.total,
          skipped: e.skipped,
        }));
        this.toastService.success(
          this.translateService.instant('components.modals.export-torrents.toast.success-message', {
            count: e.total - e.skipped,
          }),
          this.translateService.instant('components.modals.export-torrents.toast.success-title'),
        );
      }),
      api.onError((e: { message: string }) => {
        if (this._export().phase !== 'running') return;
        this._export.update((s) => ({ ...s, phase: 'error', error: e.message }));
        this.toastService.danger(
          e.message,
          this.translateService.instant('components.modals.export-torrents.toast.failed-title'),
        );
      }),
      api.onImportProgress((e: ImportProgressEvent) => {
        if (this._import().phase !== 'running') return;
        this._import.update((s) => {
          const results = new Map(s.results);
          results.set(e.hash.toLowerCase(), e.success ? 'imported' : 'failed');
          return {
            ...s,
            phase: 'running',
            current: e.current,
            total: e.total,
            name: e.name,
            results,
          };
        });
      }),
      api.onImportDone((e: { total: number; failed: number; alreadyExisted: number }) => {
        if (this._import().phase !== 'running') return;
        this._import.update((s) => ({
          ...s,
          phase: 'done',
          current: e.total,
          failed: e.failed,
          alreadyExisted: e.alreadyExisted,
        }));
        this.toastService.success(
          this.translateService.instant('components.modals.import-torrents.toast.success-message', {
            count: e.total - e.failed,
          }),
          this.translateService.instant('components.modals.import-torrents.toast.success-title'),
        );
      }),
      api.onImportError((e: { message: string }) => {
        if (this._import().phase !== 'running') return;
        this._import.update((s) => ({ ...s, phase: 'error', error: e.message }));
        this.toastService.danger(
          e.message,
          this.translateService.instant('components.modals.import-torrents.toast.failed-title'),
        );
      }),
    );
  }

  startExport(count: number): void {
    this._export.set({ ...EXPORT_IDLE, phase: 'running' });
    this.toastService.info(
      this.translateService.instant('components.modals.export-torrents.toast.started', {
        count,
      }),
    );
  }

  cancelExport(): void {
    window.bitbutler.export.cancel();
    if (this._export().phase !== 'running') return;
    this._export.set(EXPORT_IDLE);
    this.toastService.warning(
      this.translateService.instant('components.modals.export-torrents.toast.cancelled-message'),
      this.translateService.instant('components.modals.export-torrents.toast.cancelled-title'),
    );
  }

  setImportLoading(): void {
    this._import.set({ ...IMPORT_IDLE, phase: 'loading', results: new Map() });
  }

  setImportReady(metadata: BbeMetadata): void {
    this._import.update((s) => ({
      ...s,
      phase: 'ready',
      metadata,
      total: metadata.torrents.filter((t) => !t.failed).length,
    }));
  }

  setImportError(message: string): void {
    this._import.update((s) => ({ ...s, phase: 'error', error: message }));
  }

  startImport(count: number): void {
    this._import.update((s) => ({ ...s, phase: 'running' }));
    this.toastService.info(
      this.translateService.instant('components.modals.import-torrents.toast.started', {
        count,
      }),
    );
  }

  cancelImport(): void {
    window.bitbutler.export.importCancel();
    if (this._import().phase !== 'running') return;
    this._import.update((s) => ({ ...s, phase: 'ready' }));
    this.toastService.warning(
      this.translateService.instant('components.modals.import-torrents.toast.cancelled-message'),
      this.translateService.instant('components.modals.import-torrents.toast.cancelled-title'),
    );
  }

  resetExport(): void {
    this._export.set(EXPORT_IDLE);
  }

  resetImport(): void {
    this._import.set({ ...IMPORT_IDLE, results: new Map() });
  }

  ngOnDestroy(): void {
    this.unsubscribers.forEach((fn) => fn());
  }
}
