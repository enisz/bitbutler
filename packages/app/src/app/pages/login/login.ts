import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ServerRecord } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEdit, faSquare, faSquareCheck, faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { NgbDropdownModule, NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AppLoader } from '../../components/app-loader/app-loader';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ElectronService } from '../../services/electron.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerService } from '../../services/server.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { WindowService } from '../../services/window.service';
import { setModalInput } from '../../utils/modal-input';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    NgOptimizedImage,
    ReactiveFormsModule,
    NgbTooltipModule,
    NgbDropdownModule,
    NgOptionTemplateDirective,
    NgSelectComponent,
    NgLabelTemplateDirective,
    FontAwesomeModule,
    TranslatePipe,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login implements OnInit {
  private readonly confirmService = inject(ConfirmService);
  private readonly themeService = inject(ThemeService);
  private readonly modalService = inject(NgbModal);
  private readonly router = inject(Router);
  private readonly qbittorrentService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly windowService = inject(WindowService);
  private readonly toastService = inject(ToastService);
  private readonly serverService = inject(ServerService);
  private readonly electronService = inject(ElectronService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly translateService = inject(TranslateService);

  public readonly logoUrl = computed(
    () => `assets/images/bitbutler-logo-${this.themeService.family()}.png`,
  );

  public servers = this.serverStoreService.servers;
  public loading = this.serverStoreService.loading;

  public serverForm: FormGroup = new FormGroup({
    server: new FormControl<string | null>(this.serverStoreService.currentServerId()),
  });

  public icon = { faEdit, faTrashCan, faSquareCheck, faSquare };
  public version = this.electronService.getBitButlerVersion();

  public trackByFn = (_index: number, item: ServerRecord) => item?.id || _index;

  constructor() {
    effect(() => {
      const storeId = this.serverStoreService.currentServerId();
      if (this.serverForm.get('server')?.value !== storeId) {
        this.serverForm.get('server')?.patchValue(storeId, { emitEvent: false });
      }
    });
  }

  public async ngOnInit(): Promise<void> {
    this.windowService.setSize(600, 750);

    try {
      this.loading.set(true);
      await this.serverStoreService.refresh();

      const servers = this.servers();
      const autoLoginServer = servers.find((s) => s.auto_login);
      const isLogoutRedirect = this.serverStoreService.isAutoLoginSuppressed();

      let serverToSelectId: string | null = this.serverStoreService.currentServerId();

      if (autoLoginServer) {
        serverToSelectId = autoLoginServer.id;
      } else if (!serverToSelectId && servers.length > 0) {
        serverToSelectId = servers[0].id;
      }

      this.serverStoreService.select(serverToSelectId);

      this.serverForm.get('server')?.valueChanges.subscribe((id) => {
        this.serverStoreService.select(id ?? null);
      });

      if (autoLoginServer && !isLogoutRedirect) {
        this.connect();
      }
    } catch (e) {
      console.error(Login.name, 'Initialization failed', e);
    } finally {
      this.loading.set(false);
    }
  }

  public connect(): void {
    const currentServer = this.serverStoreService.currentServer();
    if (!currentServer) return;

    this.loading.set(true);
    const loadingModalRef = this.modalService.open(AppLoader, {
      size: 'sm',
      backdrop: 'static',
      keyboard: false,
    });
    setModalInput(
      loadingModalRef,
      'title',
      this.translateService.instant('pages.login.connecting'),
    );
    setModalInput(
      loadingModalRef,
      'message',
      `${currentServer.protocol}://${currentServer.host}:${currentServer.port}`,
    );

    this.qbittorrentService
      .login(currentServer.id)
      .then(async (response) => {
        if (!response.loggedIn) return;

        this.serverStoreService.clearAutoLoginSuppression();
        await this.windowService.setOpenFilesEnabled(true);
        loadingModalRef.close();
        this.router.navigate(['/pages/main']);
      })
      .catch((error) => {
        loadingModalRef.close();
        this.toastService.danger(
          error.message,
          this.translateService.instant('pages.login.error.connection-failed'),
        );
      })
      .finally(() => this.loading.set(false));
  }

  public addServer(): void {
    this.commandBusService.emit({ type: 'UI_SERVER_EDITOR_OPEN' });
  }

  public editServer(item: ServerRecord): void {
    this.commandBusService.emit({ type: 'UI_SERVER_EDITOR_OPEN', id: item.id });
  }

  public async deleteServer(item: ServerRecord): Promise<void> {
    const { id, name } = item;

    const confirmed = await this.confirmService.confirm(
      'pages.login.delete-confirm.title',
      { text: 'pages.login.delete-confirm.message', data: { name } },
      'general.button.delete',
      'general.button.cancel',
    );

    if (confirmed) {
      this.commandBusService.emit({ type: 'SERVER_DELETED', id });
    }
  }

  public async toggleAutoLogin(event: Event, item: ServerRecord): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const { id, name, auto_login } = item;
    try {
      await this.serverService.update(id, { auto_login: !auto_login });
      this.commandBusService.emit({ type: 'SERVER_UPDATED', id });
    } catch (error: any) {
      this.toastService.danger(
        error.message,
        this.translateService.instant('pages.login.error.update-server-failed', { name }),
      );
    }
  }

  public canConnect = () => !this.loading() && this.servers().length > 0;
  public goToRelease = () => this.electronService.goToRelease();
}
