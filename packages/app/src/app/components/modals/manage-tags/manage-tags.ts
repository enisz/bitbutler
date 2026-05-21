import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';

@Component({
  selector: 'app-manage-tags',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './manage-tags.html',
  styleUrl: './manage-tags.scss',
})
export class ManageTags implements OnInit {
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  public readonly activeModal = inject(NgbActiveModal);

  public tags = signal<string[]>([]);
  public nameControl = new FormControl('', [Validators.required]);
  public adding = signal(false);

  public async ngOnInit(): Promise<void> {
    try {
      const tags = await this.qbService.getAllTags(
        this.serverStoreService.currentServerId() as string,
      );
      this.tags.set([...tags].sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      console.error(ManageTags.name, 'ngOnInit', 'Failed to load tags', err);
    }
  }

  public async add(): Promise<void> {
    const name = (this.nameControl.value ?? '').trim();
    if (!name) return;
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      this.adding.set(true);
      await this.qbService.createTags(serverId, [name]);
      this.tags.set([...this.tags(), name].sort((a, b) => a.localeCompare(b)));
      this.nameControl.reset();
    } catch (err) {
      console.error(ManageTags.name, 'add', 'Failed to add tag', err);
    } finally {
      this.adding.set(false);
    }
  }

  public async delete(tag: string): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.deleteTags(serverId, [tag]);
      this.tags.set(this.tags().filter((t) => t !== tag));
    } catch (err) {
      console.error(ManageTags.name, 'delete', 'Failed to delete tag', err);
    }
  }
}
