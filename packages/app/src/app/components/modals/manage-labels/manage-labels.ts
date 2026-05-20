import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';

@Component({
  selector: 'app-manage-labels',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './manage-labels.html',
  styleUrl: './manage-labels.scss',
})
export class ManageLabels implements OnInit {
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  public readonly activeModal = inject(NgbActiveModal);

  public labels = signal<string[]>([]);
  public nameControl = new FormControl('', [Validators.required]);
  public adding = signal(false);

  public async ngOnInit(): Promise<void> {
    try {
      const tags = await this.qbService.getAllTags(
        this.serverStoreService.currentServerId() as string,
      );
      this.labels.set(tags);
    } catch (err) {
      console.error(ManageLabels.name, 'ngOnInit', 'Failed to load labels', err);
    }
  }

  public async add(): Promise<void> {
    const name = (this.nameControl.value ?? '').trim();
    if (!name) return;
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      this.adding.set(true);
      await this.qbService.createTags(serverId, [name]);
      this.labels.set([...this.labels(), name]);
      this.nameControl.reset();
    } catch (err) {
      console.error(ManageLabels.name, 'add', 'Failed to add label', err);
    } finally {
      this.adding.set(false);
    }
  }

  public async delete(label: string): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.deleteTags(serverId, [label]);
      this.labels.set(this.labels().filter((l) => l !== label));
    } catch (err) {
      console.error(ManageLabels.name, 'delete', 'Failed to delete label', err);
    }
  }
}
