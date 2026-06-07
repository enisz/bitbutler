import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import type { BbeMetadata, ExportDoneEvent, ExportProgressEvent } from '@bitbutler/shared';

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
  skipped: number;
  error?: string;
}

const EXPORT_IDLE: ExportState = { phase: 'idle', current: 0, total: 0, name: '', skipped: 0 };
const IMPORT_IDLE: ImportState = { phase: 'idle', current: 0, total: 0, name: '', skipped: 0 };

@Injectable({ providedIn: 'root' })
export class ExportService implements OnDestroy {
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
        this._export.update((s) => ({ ...s, phase: 'running', ...e })),
      ),
      api.onDone((e: ExportDoneEvent) =>
        this._export.update((s) => ({
          ...s,
          phase: 'done',
          doneEvent: e,
          current: e.total,
          skipped: e.skipped,
        })),
      ),
      api.onError((e: { message: string }) =>
        this._export.update((s) => ({ ...s, phase: 'error', error: e.message })),
      ),
      api.onImportProgress((e: ExportProgressEvent) =>
        this._import.update((s) => ({ ...s, phase: 'running', ...e })),
      ),
      api.onImportDone((e: { total: number; skipped: number }) =>
        this._import.update((s) => ({ ...s, phase: 'done', skipped: e.skipped, current: e.total })),
      ),
      api.onImportError((e: { message: string }) =>
        this._import.update((s) => ({ ...s, phase: 'error', error: e.message })),
      ),
    );
  }

  startExport(): void {
    this._export.set({ ...EXPORT_IDLE, phase: 'running' });
  }

  setImportLoading(): void {
    this._import.set({ ...IMPORT_IDLE, phase: 'loading' });
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

  startImport(): void {
    this._import.update((s) => ({ ...s, phase: 'running' }));
  }

  resetExport(): void {
    this._export.set(EXPORT_IDLE);
  }

  resetImport(): void {
    this._import.set(IMPORT_IDLE);
  }

  ngOnDestroy(): void {
    this.unsubscribers.forEach((fn) => fn());
  }
}
