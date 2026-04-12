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
      }),
    );
  }
}
