import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NewServer, ServerProtocol, ServerRecord } from '@bitbutler/shared';
import {
  faCheck,
  faCircleNotch,
  faFloppyDisk,
  faThumbsDown,
  faThumbsUp,
  faX,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../components/bb-popover/bb-popover';
import { AutofocusDirective } from '../../directives/autofocus';
import { CommandBusService } from '../../services/command-bus.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerService } from '../../services/server.service';

@Component({
  selector: 'app-server-editor',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    TranslatePipe,
    AutofocusDirective,
    NgSelectModule,
    BbPopover,
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

  readonly id = input<string | null>(null);

  public icons = {
    faThumbsUp,
    faThumbsDown,
    faCircleNotch,
    faCheck,
    faX,
    faFloppyDisk,
    faXmark,
  };

  public protocols = [
    { value: 'http', label: 'http' },
    { value: 'https', label: 'https' },
  ];

  public canTest = signal(false);
  public tested = signal(false);
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

  get name(): string {
    return this.editorForm.get('name')?.value || '';
  }
  get host(): string {
    return this.editorForm.get('host')?.value || '';
  }
  get protocol(): ServerProtocol {
    return this.editorForm.get('protocol')?.value || 'http';
  }
  get port(): number {
    return this.editorForm.get('port')?.value || 9999;
  }
  get username(): string {
    return this.editorForm.get('username')?.value || '';
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
        .catch();
    } else {
      const hasDefault = this.serverStoreService.servers().some((s) => s.auto_login);
      this.editorForm.patchValue({ autoLogin: !hasDefault });
    }
  }

  public handleSave(): void {
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
      .catch((error: any) => {
        console.error(
          ServerEditor.name,
          'handleSave',
          `Failed to ${this.id() ? 'update' : 'add'} the server`,
          error,
        );
      });
  }

  public deleteServer(): void {}

  public close(): void {
    this.activeModal.dismiss();
  }
}
