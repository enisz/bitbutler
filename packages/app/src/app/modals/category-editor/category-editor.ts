import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { SavePathSelect } from '../../components/save-path-select/save-path-select';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';

@Component({
  selector: 'app-category-editor',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, SavePathSelect],
  templateUrl: './category-editor.html',
})
export class CategoryEditor {
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly serverStoreService = inject(ServerStoreService);
  protected readonly activeModal = inject(NgbActiveModal);

  readonly nameControl = new FormControl('', { nonNullable: true });
  readonly savePathControl = new FormControl('', { nonNullable: true });

  async save(): Promise<void> {
    const name = this.nameControl.value.trim();
    const savePath = this.savePathControl.value.trim();
    if (!name || !savePath) return;

    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    await this.qbService.torrents.createCategory(serverId, name, savePath);
    this.commandBusService.emit({ type: 'CATEGORY_ADDED', name, savePath });
    this.activeModal.close();
  }
}
