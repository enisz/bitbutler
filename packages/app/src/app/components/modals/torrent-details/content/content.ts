import {
  Component,
  DestroyRef,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, from, switchMap, tap, timer } from 'rxjs';
import { TorrentFileEntry } from '../../../../models/torrent-draft.model';
import { QbTorrentContent } from '../../../../models/torrent.model';
import { ModalGuardService } from '../../../../services/modal-guard.service';
import { QbService } from '../../../../services/qb.service';
import { ServerSettingsService } from '../../../../services/server-settings.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ToastService } from '../../../../services/toast.service';
import { BbFileTree, FileTreeSaveEvent } from '../../../bb-file-tree/bb-file-tree';
import { BbSpinner } from '../../../bb-spinner/bb-spinner';
import { TorrentDetailTabComponent } from '../torrent-details.interface';

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [BbFileTree, BbSpinner, TranslatePipe],
  templateUrl: './content.html',
  styleUrl: './content.scss',
})
export class Content implements TorrentDetailTabComponent, OnChanges, OnInit {
  @Input() public hash: string = '';
  @Input() public context: Record<string, any> = {};

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly serverSettingsService = inject(ServerSettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly guardService = inject(ModalGuardService);

  public loading = signal<boolean>(true);
  public content = signal<TorrentFileEntry[]>([]);
  public startInEditMode = false;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['context']?.currentValue?.['editMode']) {
      this.startInEditMode = true;
      this.context['editMode'] = false;
    }
  }

  public async ngOnInit(): Promise<void> {
    const serverSettings = await this.serverSettingsService.load();
    const pollingInterval = serverSettings.polling.foreground;

    timer(0, pollingInterval)
      .pipe(
        switchMap(() => from(this.load())),
        tap((data: TorrentFileEntry[]) => {
          this.content.set(data);
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
  }

  public async onSaved(event: FileTreeSaveEvent): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const originalContent = this.content();
    this.content.set(event.files);

    try {
      for (const item of event.renames) {
        await this.qbService.renameTorrentFile(serverId, this.hash, item.oldPath, item.newPath);
      }

      for (const file of event.files) {
        if (file.index === undefined) continue;
        const original = originalContent.find((f) => f.index === file.index);
        if (original && original.priority !== file.priority) {
          await this.qbService.setFilePriority(
            serverId,
            this.hash,
            [file.index],
            file.priority ?? 0,
          );
        }
      }
    } catch (e) {
      console.error(Content.name, 'onSaved', 'Failed to save changes', e);
      this.toastService.danger(
        this.translateService.instant(
          'components.modals.torrent-details.content.error.failed-to-save',
        ),
      );
    }
  }

  public onEditModeChange(isEditing: boolean): void {
    this.guardService.isDirty.set(isEditing);
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
