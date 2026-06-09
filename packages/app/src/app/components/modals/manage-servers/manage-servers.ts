import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ServerRecord } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSquare, faSquareCheck, faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { faPenToSquare, faPlug, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ServerService } from '../../../services/server.service';
import { ToastService } from '../../../services/toast.service';
import { setModalInput } from '../../../utils/modal-input';
import { ServerEditor } from '../server-editor/server-editor';

@Component({
  selector: 'app-manage-servers',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FontAwesomeModule,
    NgbTooltipModule,
    TooltipOverflow,
  ],
  templateUrl: './manage-servers.html',
  styleUrl: './manage-servers.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageServers {
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly confirmService = inject(ConfirmService);
  private readonly serverService = inject(ServerService);
  private readonly qbService = inject(QbService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly modalService = inject(NgbModal);
  public readonly activeModal = inject(NgbActiveModal);

  public readonly icon = { faPenToSquare, faTrashCan, faXmark, faPlug, faSquare, faSquareCheck };
  readonly hideConnect = input(false);
  public readonly currentServerId = this.serverStoreService.currentServerId;

  public filterControl = new FormControl('');
  public editing = signal(false);
  public connectingId = signal<string | null>(null);

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

  public readonly busy = computed(() => this.editing() || !!this.connectingId());

  public clearFilter(): void {
    this.filterControl.reset();
  }

  public async openEditor(id?: string): Promise<void> {
    if (this.busy()) return;
    this.editing.set(true);
    const ref = this.modalService.open(ServerEditor, { size: 'lg' });
    if (id) setModalInput(ref, 'id', id);
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

  public async switchTo(server: ServerRecord): Promise<void> {
    if (this.busy()) return;
    this.connectingId.set(server.id);
    try {
      const hasSession = await this.qbService.hasCookie(server.id);
      if (!hasSession) {
        const loginRes = await this.qbService.login(server.id);
        if (!loginRes.loggedIn) throw new Error('Login failed');
      }
      this.serverStoreService.select(server.id);
      this.activeModal.dismiss();
    } catch (err) {
      this.toastService.danger(
        this.translateService.instant('services.menu-bar-command-handler.error.failed-to-connect', {
          name: server.name || server.host,
        }),
      );
    } finally {
      this.connectingId.set(null);
    }
  }

  public async toggleAutoLogin(server: ServerRecord): Promise<void> {
    await this.serverService.update(server.id, { auto_login: !server.auto_login });
    this.commandBusService.emit({ type: 'SERVER_UPDATED', id: server.id });
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
