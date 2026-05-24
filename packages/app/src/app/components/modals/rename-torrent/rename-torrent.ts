import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-rename-torrent',
  imports: [ReactiveFormsModule, AutofocusDirective, NgbTooltip, TranslatePipe, TooltipOverflow],
  templateUrl: './rename-torrent.html',
  styleUrl: './rename-torrent.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenameTorrent implements OnInit {
  @Input() torrent!: Torrent;

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  public readonly activeModal = inject(NgbActiveModal);
  private readonly translateService = inject(TranslateService);

  public processing = signal(false);

  public renameTorrentForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
  });

  public ngOnInit(): void {
    this.renameTorrentForm.get('name')?.patchValue(this.torrent.name);
  }

  public async handleSubmit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() ?? '';
    const desiredRaw = (this.renameTorrentForm.get('name')?.value ?? '').trim();

    if (!serverId) {
      console.error(RenameTorrent.name, 'handleSubmit', 'Failed to get server id');
      return;
    }

    if (!desiredRaw) {
      console.error(RenameTorrent.name, 'handleSubmit', 'Failed to get new name!');
      return;
    }

    try {
      this.processing.set(true);
      await this.renameTorrentContent(serverId, this.torrent.hash, desiredRaw);
      await this.qbService.renameTorrent(serverId, this.torrent.hash, desiredRaw);
    } catch (error: any) {
      console.error(RenameTorrent.name, 'handleSubmit', 'Failed to rename the torrent!');
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant('components.modals.rename-torrent.error.failed-to-rename'),
      );
    } finally {
      this.processing.set(false);
      this.activeModal.close();
    }
  }

  public canSave(): boolean {
    const v = (this.renameTorrentForm.get('name')?.value ?? '').trim();
    return (
      this.renameTorrentForm.valid &&
      v !== (this.torrent.name ?? '').trim() &&
      this.processing() === false
    );
  }

  private async renameTorrentContent(
    serverId: string,
    hash: string,
    desiredRaw: string,
  ): Promise<void> {
    const contents = await this.qbService.torrentContents(serverId, hash);
    if (!contents || contents.length === 0) {
      return;
    }

    const first = (contents[0]?.name ?? '').trim();
    const isSingleFile = contents.length === 1 && first && !this.hasFolderPrefix(first);

    if (isSingleFile) {
      const oldName = first;
      const newName = this.buildSingleFileName(oldName, desiredRaw);
      if (!newName || newName === oldName) return;

      await this.qbService.renameTorrentFile(serverId, hash, oldName, newName);
      return;
    }

    const root = this.getRootFolder(first);
    if (!root) return;

    const newRoot = this.sanitizeFolderName(desiredRaw);
    if (!newRoot || newRoot === root) return;

    await this.qbService.renameTorrentFolder(serverId, hash, root, newRoot);
  }

  private hasFolderPrefix(path: string): boolean {
    return (path ?? '').includes('/');
  }

  private getRootFolder(path: string): string | null {
    const p = (path ?? '').trim();
    if (!p) return null;
    const idx = p.indexOf('/');
    if (idx <= 0) return null;
    return p.slice(0, idx);
  }

  private buildSingleFileName(_oldName: string, desiredRaw: string): string {
    return this.sanitizeFileName(desiredRaw);
  }

  private sanitizeFileName(input: string): string {
    return (input ?? '')
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
      .replace(/\s+$/g, '')
      .replace(/\.+$/g, '');
  }

  private sanitizeFolderName(input: string): string {
    const v = this.sanitizeFileName(input).replace(/\//g, '').replace(/\\/g, '');
    if (!v) return '';
    if (v === '.' || v === '..') return '';
    return v;
  }
}
