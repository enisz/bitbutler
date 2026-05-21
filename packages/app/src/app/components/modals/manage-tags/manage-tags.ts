import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { NgbActiveModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';

@Component({
  selector: 'app-manage-tags',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, FontAwesomeModule, NgbTooltipModule],
  templateUrl: './manage-tags.html',
  styleUrl: './manage-tags.scss',
})
export class ManageTags implements OnInit {
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly confirmService = inject(ConfirmService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  public readonly activeModal = inject(NgbActiveModal);

  public readonly icon = { faTrashCan };

  public tags = signal<string[]>([]);
  public nameControl = new FormControl('', [Validators.required]);
  public filterControl = new FormControl('');
  public adding = signal(false);
  public loading = signal(true);

  private readonly filterValue = toSignal(this.filterControl.valueChanges, { initialValue: '' });

  public readonly filteredTags = computed(() => {
    const filter = (this.filterValue() ?? '').toLowerCase();
    if (!filter) return this.tags();
    return this.tags().filter((tag) => tag.toLowerCase().includes(filter));
  });

  public async ngOnInit(): Promise<void> {
    try {
      const tags = await this.qbService.getAllTags(
        this.serverStoreService.currentServerId() as string,
      );
      this.tags.set([...tags].sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      console.error(ManageTags.name, 'ngOnInit', 'Failed to load tags', err);
    } finally {
      this.loading.set(false);
    }
  }

  public async add(): Promise<void> {
    const raw = (this.nameControl.value ?? '').trim();
    if (!raw) return;
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      this.adding.set(true);
      await this.qbService.createTags(serverId, names);
      this.tags.set([...this.tags(), ...names].sort((a, b) => a.localeCompare(b)));
      this.nameControl.reset();
    } catch (err) {
      console.error(ManageTags.name, 'add', 'Failed to add tag', err);
    } finally {
      this.adding.set(false);
    }
  }

  public async delete(tag: string): Promise<void> {
    const count = this.torrentStoreService.torrentsArray().filter((t) =>
      (t.tags ?? '')
        .split(',')
        .map((s) => s.trim())
        .includes(tag),
    ).length;

    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-tags.delete-confirm.title',
      {
        text: 'components.modals.manage-tags.delete-confirm.message',
        data: { name: tag, count },
      },
      'general.button.delete',
    );
    if (!confirmed) return;

    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.deleteTags(serverId, [tag]);
      this.tags.set(this.tags().filter((t) => t !== tag));
    } catch (err) {
      console.error(ManageTags.name, 'delete', 'Failed to delete tag', err);
    }
  }
}
