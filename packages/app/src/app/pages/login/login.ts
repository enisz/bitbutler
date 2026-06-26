import { NgClass, NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ServerRecord } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCircleHalfStroke,
  faLanguage,
  faPalette,
  faPlug,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { NgbDropdownModule, NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { NgLabelTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { debounceTime, firstValueFrom, fromEvent } from 'rxjs';
import { AppLoader } from '../../components/app-loader/app-loader';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { CommandBusService } from '../../services/command-bus.service';
import { ElectronService } from '../../services/electron.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerService } from '../../services/server.service';
import {
  THEME_FAMILIES,
  ThemeFamily,
  ThemeMode,
  ThemeService,
  getFamilyLogoUrl,
} from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { WindowService } from '../../services/window.service';
import { setModalInput } from '../../utils/modal-input';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    NgOptimizedImage,
    NgClass,
    ReactiveFormsModule,
    NgbTooltipModule,
    NgbDropdownModule,
    FontAwesomeModule,
    NgSelectComponent,
    NgLabelTemplateDirective,
    TranslatePipe,
    BbBtnContent,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login implements OnInit {
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
  private readonly generalSettingsService = inject(GeneralSettingsService);

  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly logoUrl = computed(() => getFamilyLogoUrl(this.themeService.family()));

  public readonly icons = { faLanguage, faPalette, faCircleHalfStroke, faPlug, faServer };

  public readonly families = THEME_FAMILIES;

  public readonly languages = computed<{ value: string; label: string }[]>(() => {
    this.languageChanged();

    return [
      { value: 'us', label: this.translateService.instant('language.us') },
      { value: 'hu', label: this.translateService.instant('language.hu') },
    ].sort((a, b) => a.label.localeCompare(b.label));
  });

  public readonly modes = computed<{ value: ThemeMode; label: string }[]>(() => {
    this.languageChanged();

    return [
      {
        value: 'light',
        label: this.translateService.instant('pages.settings.tab.general.mode.light'),
      },
      {
        value: 'dark',
        label: this.translateService.instant('pages.settings.tab.general.mode.dark'),
      },
      {
        value: 'system',
        label: this.translateService.instant('pages.settings.tab.general.mode.system'),
      },
    ];
  });

  public readonly currentFamily = this.themeService.family;
  public readonly currentMode = this.themeService.mode;

  public readonly currentLang = computed(() => {
    this.languageChanged();
    return this.translateService.getCurrentLang();
  });

  public readonly getFamilyLogoUrl = getFamilyLogoUrl;

  public servers = this.serverStoreService.servers;
  public loading = this.serverStoreService.loading;

  public serverForm: FormGroup = new FormGroup({
    server: new FormControl<string | null>(this.serverStoreService.currentServerId()),
  });

  public version = this.electronService.getBitButlerVersion();

  public trackByFn = (_index: number, item: ServerRecord) => item?.id || _index;

  protected readonly showHero = signal(window.innerWidth >= 768);

  constructor() {
    fromEvent(window, 'resize')
      .pipe(debounceTime(50), takeUntilDestroyed())
      .subscribe(() => this.showHero.set(window.innerWidth >= 768));

    effect(() => {
      const storeId = this.serverStoreService.currentServerId();
      if (this.serverForm.get('server')?.value !== storeId) {
        this.serverForm.get('server')?.patchValue(storeId, { emitEvent: false });
      }
    });
  }

  public async ngOnInit(): Promise<void> {
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
        void this.connect();
      }
    } catch (e) {
      console.error(Login.name, 'Initialization failed', e);
    } finally {
      this.loading.set(false);
    }
  }

  public async connect(): Promise<void> {
    const currentServer = this.serverStoreService.currentServer();
    if (!currentServer) return;

    let runtimeUsername: string | undefined;
    let runtimePassword: string | undefined;

    if (!currentServer.username || !currentServer.has_password) {
      const { CredentialPrompt } =
        await import('../../components/modals/credential-prompt/credential-prompt');
      const credModalRef = this.modalService.open(CredentialPrompt);
      setModalInput(credModalRef, 'serverName', currentServer.name);
      setModalInput(credModalRef, 'prefillUsername', currentServer.username);

      try {
        const result = (await credModalRef.result) as {
          username: string;
          password: string;
          save: boolean;
        };

        if (result.save && (result.username || result.password)) {
          await this.serverService.update(currentServer.id, {
            username: result.username,
            password: result.password,
          });
          this.commandBusService.emit({ type: 'SERVER_UPDATED', id: currentServer.id });
        } else {
          runtimeUsername = result.username;
          runtimePassword = result.password;
        }
      } catch {
        return;
      }
    }

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

    await this.qbittorrentService.auth
      .login(currentServer.id, runtimeUsername, runtimePassword)
      .then(async (response) => {
        if (!response.loggedIn) return;
        this.serverStoreService.clearAutoLoginSuppression();

        if (currentServer.export_available === null) {
          try {
            const { available } = await window.bitbutler.export.checkAvailability(currentServer.id);
            await window.bitbutler.server.setExportAvailable({
              id: currentServer.id,
              value: available ? 1 : 0,
            });
            await this.serverStoreService.refresh();
          } catch (e) {
            console.error(Login.name, 'connect', 'export_available probe failed', e);
          }
        }

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

  public async openManageServers(): Promise<void> {
    const { ManageServers } = await import('../../components/modals/manage-servers/manage-servers');
    const ref = this.modalService.open(ManageServers);
    setModalInput(ref, 'hideConnect', true);
  }

  public canConnect = () => !this.loading() && this.servers().length > 0;
  public goToRelease = () => this.electronService.goToRelease();

  public setFamily(family: ThemeFamily): void {
    this.themeService.setFamily(family);
  }

  public setMode(mode: ThemeMode): void {
    this.themeService.setMode(mode);
  }

  public async setLanguage(lang: string): Promise<void> {
    if (this.translateService.getCurrentLang() === lang) return;

    const settings = await this.generalSettingsService.load();
    settings.language.language = lang;
    await this.generalSettingsService.save(settings);
    await firstValueFrom(this.translateService.use(lang));
  }
}
