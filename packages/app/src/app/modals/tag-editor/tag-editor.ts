import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';

@Component({
  selector: 'app-tag-editor',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  templateUrl: './tag-editor.html',
})
export class TagEditor {
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly serverStoreService = inject(ServerStoreService);
  protected readonly activeModal = inject(NgbActiveModal);

  readonly nameControl = new FormControl('', { nonNullable: true });

  async save(): Promise<void> {
    const raw = this.nameControl.value.trim();
    if (!raw) return;

    const names = Array.from(
      new Set(
        raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
    if (!names.length) return;

    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    await this.qbService.torrents.createTags(serverId, names);
    this.commandBusService.emit({ type: 'TAG_ADDED', names });
    this.activeModal.close();
  }
}
