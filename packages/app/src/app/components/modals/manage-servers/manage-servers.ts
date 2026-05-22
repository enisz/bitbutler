import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { faPencil, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { ServerRecord } from '../../../models/server.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ServerEditor } from '../server-editor/server-editor';

@Component({
  selector: 'app-manage-servers',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, FontAwesomeModule, NgbTooltipModule],
  templateUrl: './manage-servers.html',
  styleUrl: './manage-servers.scss',
})
export class ManageServers {
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly confirmService = inject(ConfirmService);
  private readonly modalService = inject(NgbModal);
  public readonly activeModal = inject(NgbActiveModal);

  public readonly icon = { faPencil, faTrashCan, faXmark };

  public filterControl = new FormControl('');
  public editing = signal(false);

  private readonly filterValue = toSignal(this.filterControl.valueChanges, { initialValue: '' });

  public readonly filteredServers = computed(() => {
    const filter = (this.filterValue() ?? '').toLowerCase();
    const servers = this.serverStoreService.servers();
    if (!filter) return servers;
    return servers.filter(
      (s) => s.name.toLowerCase().includes(filter) || s.host.toLowerCase().includes(filter),
    );
  });

  public readonly hasServers = computed(() => this.serverStoreService.servers().length > 0);

  public clearFilter(): void {
    this.filterControl.reset();
  }

  public async openEditor(id?: string): Promise<void> {
    if (this.editing()) return;
    this.editing.set(true);
    const ref = this.modalService.open(ServerEditor, { size: 'lg' });
    if (id) ref.componentInstance.id = id;
    try {
      const newId: string = await ref.result;
      if (!id) {
        this.commandBusService.emit({ type: 'SERVER_ADDED', id: newId });
      }
    } catch (_e) {
    } finally {
      this.editing.set(false);
    }
  }

  public async delete(server: ServerRecord): Promise<void> {
    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-servers.delete-confirm.title',
      {
        text: 'components.modals.manage-servers.delete-confirm.message',
        data: { name: server.name || server.host },
      },
      'general.button.delete',
    );
    if (!confirmed) return;

    this.commandBusService.emit({ type: 'SERVER_DELETED', id: server.id });
  }
}
