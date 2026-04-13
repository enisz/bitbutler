import { Component, DestroyRef, inject, Input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, EMPTY, from, switchMap, take, tap, timer } from 'rxjs';
import { TorrentFileEntry } from '../../../../models/torrent-draft.model';
import { QbTorrentContent } from '../../../../models/torrent.model';
import { QbService } from '../../../../services/qb.service';
import { ServerSettingsService } from '../../../../services/server-settings.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ToastService } from '../../../../services/toast.service';
import { BbFileTree } from '../../../bb-file-tree/bb-file-tree';
import { BbSpinner } from '../../../bb-spinner/bb-spinner';
import { TorrentDetailTabComponent } from '../torrent-details.interface';

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [BbFileTree, BbSpinner, TranslatePipe],
  templateUrl: './content.html',
  styleUrl: './content.scss',
})
export class Content implements TorrentDetailTabComponent, OnInit {
  @Input() public hash: string = '';
  @Input() public context: Record<string, any> = {};

  public editMode = signal<boolean>(false);

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly serverSettingsService = inject(ServerSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  public loading = signal<boolean>(true);
  public isSaving = signal<boolean>(false);
  public originalContent: TorrentFileEntry[] = [];
  public renameQueue: { type: 'file' | 'folder'; oldPath: string; newPath: string }[] = [];
  public content: TorrentFileEntry[] = [];

  public async ngOnInit(): Promise<void> {
    const serverSettings = await this.serverSettingsService.load();
    const pollingInterval = serverSettings.polling.foreground;

    timer(0, pollingInterval)
      .pipe(
        switchMap(() => from(this.load())),
        take(1), // run only once
        tap((data: TorrentFileEntry[]) => {
          this.content = data;
          this.loading.set(false);
        }),
        catchError((e) => {
          console.error(Content.name, 'load', 'Failed to load torrent contents', e);
          this.toastService.danger(
            this.translateService.instant(
              'components.modals.torrent-details.content.error.failed-to-load',
            ),
          );
          this.loading.set(false);
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    if (this.context['editMode']) {
      this.editMode.set(this.context['editMode']);
    }
  }

  public enterEditMode(): void {
    this.originalContent = structuredClone(this.content);
    this.renameQueue = [];
    this.editMode.set(true);
  }

  public cancelEdit(): void {
    this.content = this.originalContent;
    this.renameQueue = [];
    this.editMode.set(false);
  }

  public async saveEdit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    this.isSaving.set(true);
    try {
      for (const item of this.renameQueue) {
        if (item.type === 'folder') {
          await this.qbService.renameTorrentFolder(serverId, this.hash, item.oldPath, item.newPath);
        } else {
          await this.qbService.renameTorrentFile(serverId, this.hash, item.oldPath, item.newPath);
        }
      }

      for (const file of this.content) {
        if (file.index === undefined) continue;
        const original = this.originalContent.find((f) => f.index === file.index);
        if (original && original.priority !== file.priority) {
          await this.qbService.setFilePriority(
            serverId,
            this.hash,
            [file.index],
            file.priority ?? 0,
          );
        }
      }

      this.renameQueue = [];
      this.originalContent = [];
      this.editMode.set(false);
    } catch (e) {
      console.error(Content.name, 'saveEdit', 'Failed to save changes', e);
      this.toastService.danger(
        this.translateService.instant(
          'components.modals.torrent-details.content.error.failed-to-save',
        ),
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  public onFileRenamed(event: { oldPath: string; newPath: string }): void {
    this.renameQueue.push({ type: 'file', ...event });
  }

  public onFolderRenamed(event: { oldPath: string; newPath: string }): void {
    this.renameQueue.push({ type: 'folder', ...event });
  }

  public onFilesChanged(files: TorrentFileEntry[]): void {
    this.content = files;
  }

  private async load(): Promise<TorrentFileEntry[]> {
    const serverId = this.serverStoreService.currentServerId();
    const hash = this.hash;

    if (!serverId) throw new Error('ServerId is missing!');
    if (!hash) throw new Error('Torrent hash is missing!');

    return (await this.qbService.torrentContents(serverId, hash)).map(
      (content: QbTorrentContent) => ({
        length: content.size,
        path: content.name,
        priority: content.priority,
        progress: content.progress,
        index: content.index,
      }),
    );
  }
}
