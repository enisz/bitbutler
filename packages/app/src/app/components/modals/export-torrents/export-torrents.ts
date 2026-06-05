import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { ExportScope, ExportStartPayload } from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { ExportService } from '../../../services/export.service';
import { FilterService } from '../../../services/filter.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';

@Component({
  selector: 'app-export-torrents',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './export-torrents.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportTorrents implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);
  readonly exportService = inject(ExportService);
  private readonly filterService = inject(FilterService);
  private readonly selectionStore = inject(SelectionStoreService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly serverStore = inject(ServerStoreService);

  exportForm!: FormGroup;

  readonly allCount = computed(() => this.torrentStore.torrents().length);
  readonly filteredCount = computed(() => this.filterService.filtered().length);
  readonly selectedCount = computed(() => this.selectionStore.selected().length);
  readonly hasSelection = computed(() => this.selectedCount() > 0);
  readonly hasFiltered = computed(() => this.filteredCount() > 0);

  readonly phase = this.exportService.exportPhase;
  readonly state = this.exportService.exportState;

  readonly isRunning = computed(() => this.phase() === 'running');
  readonly isDone = computed(() => this.phase() === 'done');
  readonly isError = computed(() => this.phase() === 'error');

  readonly progressPct = computed(() => {
    const s = this.state();
    return s.total > 0 ? Math.round((s.current / s.total) * 100) : 0;
  });

  ngOnInit(): void {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const serverName = (this.serverStore.currentServer()?.name ?? 'export')
      .toLowerCase()
      .replace(/\s+/g, '-');

    this.exportForm = new FormGroup({
      scope: new FormControl<ExportScope>('all', { nonNullable: true }),
      destDir: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      filename: new FormControl(`${serverName}-${dateStr}`, {
        nonNullable: true,
        validators: [Validators.required],
      }),
    });
  }

  async browseDestDir(): Promise<void> {
    const dir = await window.bitbutler.electron.showOpenDialog();
    if (dir) this.exportForm.get('destDir')?.setValue(dir);
  }

  startExport(): void {
    if (this.exportForm.invalid) return;
    const { scope, destDir, filename } = this.exportForm.getRawValue();

    let hashes: string[];
    if (scope === 'selected') {
      hashes = this.selectionStore.selected().map((t) => t.hash);
    } else if (scope === 'filtered') {
      hashes = this.filterService.filtered().map((t) => t.hash);
    } else {
      hashes = this.torrentStore.torrents().map((t) => t.hash);
    }

    const serverId = this.serverStore.currentServer()?.id ?? '';
    const payload: ExportStartPayload = { serverId, scope, hashes, destDir, filename };

    this.exportService.startExport();
    window.bitbutler.export.start(payload);
  }

  cancelExport(): void {
    window.bitbutler.export.cancel();
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
