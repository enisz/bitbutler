import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NewServer, ServerProtocol, ServerRecord } from '@bitbutler/shared';
import {
  faCheck,
  faCircleNotch,
  faFloppyDisk,
  faPlus,
  faThumbsDown,
  faThumbsUp,
  faTrashCan,
  faX,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { filter, firstValueFrom } from 'rxjs';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { AutofocusDirective } from '../../directives/autofocus';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerService } from '../../services/server.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-server-editor',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    TranslatePipe,
    AutofocusDirective,
    NgSelectModule,
    TranslatePipe,
    BbBtnContent,
  ],
  templateUrl: './server-editor.html',
  styleUrl: './server-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerEditor implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);
  private readonly serverService = inject(ServerService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly confirmService = inject(ConfirmService);

  readonly id = input<string | null>(null);

  public icons = {
    faThumbsUp,
    faThumbsDown,
    faCircleNotch,
    faCheck,
    faX,
    faFloppyDisk,
    faPlus,
    faXmark,
    faTrashCan,
  };

  public protocols = [
    { value: 'http', label: 'http' },
    { value: 'https', label: 'https' },
  ];

  public processing = signal(false);
  public canSave = signal(false);
  public editMode = signal(false);
  public hasSavedPassword = signal(false);

  public editorForm: FormGroup<{
    name: FormControl<string>;
    host: FormControl<string>;
    protocol: FormControl<ServerProtocol>;
    port: FormControl<number>;
    username: FormControl<string>;
    password: FormControl<string>;
    autoLogin: FormControl<boolean>;
  }> = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    host: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    protocol: new FormControl<ServerProtocol>('http', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    port: new FormControl<number>(8080, { nonNullable: true, validators: [Validators.required] }),
    username: new FormControl<string>('', { nonNullable: true }),
    password: new FormControl<string>('', { nonNullable: true }),
    autoLogin: new FormControl<boolean>(true, { nonNullable: true }),
  });

  private readonly rawName = toSignal(this.editorForm.controls.name.valueChanges, {
    initialValue: this.editorForm.controls.name.value,
  });
  private readonly rawProtocol = toSignal(this.editorForm.controls.protocol.valueChanges, {
    initialValue: this.editorForm.controls.protocol.value,
  });
  private readonly rawHost = toSignal(this.editorForm.controls.host.valueChanges, {
    initialValue: this.editorForm.controls.host.value,
  });
  private readonly rawPort = toSignal(this.editorForm.controls.port.valueChanges, {
    initialValue: this.editorForm.controls.port.value,
  });

  // Protocol and port always have a value, so this is never blank - no need to fall
  // back to a placeholder to keep the header subtitle line from collapsing.
  public readonly connectionSubtitle = computed(() =>
    `${(this.rawName() ?? '').trim()} <${this.rawProtocol()}://${(this.rawHost() ?? '').trim()}:${this.rawPort() ?? ''}>`.trim(),
  );

  get name(): string {
    return (this.editorForm.get('name')?.value || '').trim();
  }
  get host(): string {
    return (this.editorForm.get('host')?.value || '').trim();
  }
  get protocol(): ServerProtocol {
    return this.editorForm.get('protocol')?.value || 'http';
  }
  get port(): number {
    return this.editorForm.get('port')?.value || 9999;
  }
  get username(): string {
    return (this.editorForm.get('username')?.value || '').trim();
  }
  get password(): string {
    return this.editorForm.get('password')?.value || '';
  }
  get autoLogin(): boolean {
    return this.editorForm.get('autoLogin')?.value || false;
  }

  constructor() {
    this.editorForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.canSave.set(this.editorForm.valid));

    this.editorForm
      .get('name')
      ?.valueChanges.pipe(
        filter(() => !this.id()),
        filter(() => this.editorForm.get('host')?.touched === false),
        takeUntilDestroyed(),
      )
      .subscribe((value: string) => this.editorForm.get('host')?.patchValue(value));
  }

  public ngOnInit(): void {
    if (this.id()) {
      this.editMode.set(true);

      this.serverService
        .getById(this.id()!)
        .then((server: ServerRecord | null) => {
          this.hasSavedPassword.set(server?.has_password ?? false);
          this.editorForm.patchValue({
            name: server?.name,
            protocol: server?.protocol,
            host: server?.host,
            port: server?.port || 8080,
            username: server?.username,
            autoLogin: server?.auto_login || false,
          });
        })
        .catch(async () => {
          const title = await firstValueFrom(
            this.translateService.get('components.modals.server-editor.toast.load-failed-title'),
          );
          const message = await firstValueFrom(
            this.translateService.get('components.modals.server-editor.toast.load-failed'),
          );
          this.toastService.danger(message, title);
          this.activeModal.dismiss();
        });
    } else {
      const hasDefault = this.serverStoreService.servers().some((s) => s.auto_login);
      this.editorForm.patchValue({ autoLogin: !hasDefault });
    }
  }

  public handleSave(): void {
    if (this.processing()) return;
    this.processing.set(true);

    let promise: Promise<boolean | { id: string }>;

    if (this.id()) {
      const changes: Partial<NewServer> = {
        name: this.name,
        protocol: this.protocol,
        host: this.host,
        port: this.port,
        username: this.username,
        password: this.password,
        auto_login: this.autoLogin,
      };
      promise = this.serverService.update(this.id()!, changes);
    } else {
      promise = this.serverService.add({
        name: this.name,
        protocol: this.protocol,
        host: this.host,
        port: this.port,
        username: this.username,
        password: this.password,
        auto_login: this.autoLogin,
      });
    }

    promise
      .then((response: boolean | { id: string }) => {
        const id = this.id() || (response as { id: string }).id;
        const type = this.id() ? 'SERVER_UPDATED' : 'SERVER_ADDED';

        if (typeof response === 'boolean') {
          this.commandBusService.emit({ type, id });
          this.activeModal.close(this.id());
        } else {
          this.activeModal.close(response.id);
        }
      })
      .catch((error: unknown) => {
        console.error(
          ServerEditor.name,
          'handleSave',
          `Failed to ${this.id() ? 'update' : 'add'} the server`,
          error,
        );
      })
      .finally(() => this.processing.set(false));
  }

  public async handleDelete(): Promise<void> {
    const id = this.id();
    if (!id || this.processing()) return;

    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-servers.delete-confirm.title',
      {
        text: 'components.modals.manage-servers.delete-confirm.message',
        data: { name: this.name || this.host },
      },
      'general.button.delete',
      undefined,
      undefined,
      faTrashCan,
    );
    if (!confirmed) return;

    this.commandBusService.emit({ type: 'SERVER_DELETED', id });
    // Dismiss rather than close - callers treat a close result as a saved server id.
    this.activeModal.dismiss();
  }

  public close(): void {
    this.activeModal.dismiss();
  }
}
