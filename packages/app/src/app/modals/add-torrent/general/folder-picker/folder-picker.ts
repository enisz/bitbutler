import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  PendingTasks,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import type { TorrentDraft } from '@bitbutler/shared';
import {
  ScannedTorrentEntry,
  ScannedTorrentState,
} from '../../../../models/add-torrent-folder.model';
import { AddTorrentFormGroup } from '../../../../models/add-torrent.model';
import { TorrentStoreService } from '../../../../services/torrent-store.service';

@Component({
  selector: 'app-add-torrent-folder-picker',
  imports: [ReactiveFormsModule],
  templateUrl: './folder-picker.html',
  styleUrl: './folder-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentFolderPicker implements OnInit {
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);

  public form = input.required<AddTorrentFormGroup>();

  public readonly rows = signal<ScannedTorrentEntry[]>([]);
  public readonly loading = signal(false);
  public readonly scanError = signal<string | null>(null);
  public readonly selectedPaths = signal<Set<string>>(new Set());

  public readonly selectedEntries = computed(() =>
    this.rows().filter((r) => this.selectedPaths().has(r.path)),
  );

  private readonly cache = new Map<string, ScannedTorrentEntry>();
  private hasScannedOnce = false;

  private get folderControl() {
    return this.form().controls.folderGroup.controls.folder;
  }

  private get recursiveControl() {
    return this.form().controls.folderGroup.controls.recursive;
  }

  public async ngOnInit(): Promise<void> {
    this.recursiveControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.hasScannedOnce) void this.scan();
    });

    let folder = this.folderControl.value?.trim();
    if (!folder) {
      folder = (await window.bitbutler.electron.getDownloadsPath()) ?? '';
      this.folderControl.setValue(folder, { emitEvent: false });
    }
    if (folder) await this.scan();
  }

  public async browse(): Promise<void> {
    const current = this.folderControl.value?.trim();
    const defaultPath = current || (await window.bitbutler.electron.getDownloadsPath());
    const selected = await window.bitbutler.electron.showOpenDialog(defaultPath);
    if (!selected) return;

    this.folderControl.setValue(selected);
    await this.scan();
  }

  public async refresh(): Promise<void> {
    await this.scan();
  }

  public renameEntry(path: string, newName: string): void {
    const cached = this.cache.get(path);
    if (cached) cached.name = newName;
    this.rows.update((rows) => rows.map((r) => (r.path === path ? { ...r, name: newName } : r)));
  }

  private async scan(): Promise<void> {
    const folder = this.folderControl.value?.trim();
    if (!folder) return;

    const done = this.pendingTasks.add();
    this.loading.set(true);
    this.scanError.set(null);
    try {
      const found = await window.bitbutler.torrent.scanFolder({
        path: folder,
        recursive: this.recursiveControl.value,
      });

      const entries: ScannedTorrentEntry[] = [];
      for (const { path, relativePath } of found) {
        const cached = this.cache.get(path);
        if (cached) {
          entries.push(cached);
          continue;
        }
        const entry = await this.parseEntry(path, relativePath);
        this.cache.set(path, entry);
        entries.push(entry);
      }

      this.rows.set(entries);
      this.selectedPaths.set(new Set(entries.filter((e) => e.state === 'new').map((e) => e.path)));
      this.hasScannedOnce = true;
    } catch (e) {
      this.scanError.set(String((e as Error)?.message ?? e));
      this.rows.set([]);
    } finally {
      this.loading.set(false);
      done();
    }
  }

  private async parseEntry(path: string, relativePath: string): Promise<ScannedTorrentEntry> {
    const draft: TorrentDraft = await window.bitbutler.torrent.parse({ source: 'manual', path });

    if (draft.error) {
      return {
        path,
        relativePath,
        name: draft.originalName ?? path,
        size: 0,
        fileCount: 0,
        folderCount: 0,
        state: 'error',
        errorMessage: draft.error.message,
        hash: null,
      };
    }

    const files = draft.torrent?.files ?? [];
    const hash = draft.torrent?.infoHashV1?.toLowerCase() ?? null;
    const state: ScannedTorrentState =
      hash && this.torrentStoreService.torrentsMap().has(hash) ? 'exists' : 'new';

    return {
      path,
      relativePath,
      name: draft.torrent?.name ?? draft.originalName ?? path,
      size: draft.torrent?.totalSize ?? 0,
      fileCount: files.length || 1,
      folderCount: countUniqueFolders(files.map((f) => f.path)),
      state,
      hash,
    };
  }
}

function countUniqueFolders(filePaths: string[]): number {
  const folders = new Set<string>();
  for (const p of filePaths) {
    const segments = p.split('/');
    for (let i = 1; i < segments.length; i++) {
      folders.add(segments.slice(0, i).join('/'));
    }
  }
  return folders.size;
}
