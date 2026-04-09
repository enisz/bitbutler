import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { NgbModalConfig, NgbTooltipConfig } from '@ng-bootstrap/ng-bootstrap';
import { LangChangeEvent, TranslateService } from '@ngx-translate/core';
import { TimeagoIntl } from 'ngx-timeago';
import { strings as usStrings } from 'ngx-timeago/language-strings/en.js';
import { strings as huStrings } from 'ngx-timeago/language-strings/hu.js';
import { filter } from 'rxjs';
import { GeneralSettings } from './models/general-settings.model';
import { CommandBusService } from './services/command-bus.service';
import { ElectronService } from './services/electron.service';
import { GeneralSettingsService } from './services/general-settings.service';
import { MenuBarCommandHandlerService } from './services/menu-bar-command-handler.service';
import { NotificationService } from './services/notification.service';
import { OpenFilesService } from './services/open-files.service';
import { ServerCommandHandlerService } from './services/server-command-handler.service';
import { ToastService } from './services/toast.service';
import { TorrentCommandHandlerService } from './services/torrent-command-handler.service';
import { TorrentFinishedEvent, TorrentStoreService } from './services/torrent-store.service';
import { TransferLimitCommandHandlerService } from './services/transfer-limit-command-handler.service';
import { UiCommandHandlerService } from './services/ui-command-handler.service';
import { UpdateCommandHandlerService } from './services/update-command-handler.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly electronService = inject(ElectronService);
  private readonly modalConfigService = inject(NgbModalConfig);
  private readonly openFilesService = inject(OpenFilesService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly notificationService = inject(NotificationService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly uiCommandHandlerService = inject(UiCommandHandlerService);
  private readonly menuBarCommandHandlerService = inject(MenuBarCommandHandlerService);
  private readonly torrentCommandHandlerService = inject(TorrentCommandHandlerService);
  private readonly tooltipConfigService = inject(NgbTooltipConfig);
  private readonly toastService = inject(ToastService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly transferLimitcommandHandlerService = inject(TransferLimitCommandHandlerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly serverCommandHandlerService = inject(ServerCommandHandlerService);
  private readonly updateCommandHandlerService = inject(UpdateCommandHandlerService);
  private readonly translateService = inject(TranslateService);
  private readonly timeagoIntl = inject(TimeagoIntl);

  public isDev$ = this.electronService.isDev();
  private updateCheckedOnStartup = false;

  private readonly _openDraftsEffect = effect(() => {
    const items = this.openFilesService.pendingDrafts();
    if (!items.length) return;

    this.commandBusService.emit({ type: 'UI_ADD_TORRENT' });
  });

  constructor() {
    this.modalConfigService.keyboard = true;
    this.modalConfigService.centered = true;
    this.modalConfigService.animation = true;

    this.tooltipConfigService.container = 'body';

    this.openFilesService.start();
  }

  public ngOnInit(): void {
    this.openFilesService.start();
    this.uiCommandHandlerService.start();
    this.menuBarCommandHandlerService.start();
    this.torrentCommandHandlerService.start();
    this.transferLimitcommandHandlerService.start();
    this.serverCommandHandlerService.start();
    this.updateCommandHandlerService.start();

    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: LangChangeEvent) => this.setTimeagoLanguage(event.lang));

    this.torrentStoreService.finished$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: TorrentFinishedEvent) => {
        const message = this.translateService.instant('app.success.finished-downloading');

        this.notificationService.send(message, event.torrent.name);
        this.toastService.success(event.torrent.name, message);
      });

    this.generalSettingsService
      .asObservable()
      .pipe(
        filter((settings): settings is GeneralSettings => !!settings),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((generalSettings: GeneralSettings) => {
        if (generalSettings?.behavior.automaticUpdate && !this.updateCheckedOnStartup) {
          this.commandBusService.emit({ type: 'UPDATE_CHECK_FOR_UPDATE' });
          this.updateCheckedOnStartup = true;
        }

        if (generalSettings?.language.language) {
          if (this.translateService.getCurrentLang() !== generalSettings.language.language) {
            this.translateService.use(generalSettings.language.language);
          }
        }
      });
  }

  private setTimeagoLanguage(lang: string): void {
    switch (lang) {
      case 'us':
        this.timeagoIntl.strings = usStrings;
        break;
      case 'hu':
        this.timeagoIntl.strings = huStrings;
        break;
      case 'en':
      default:
        this.timeagoIntl.strings = usStrings;
        break;
    }

    this.timeagoIntl.changes.next();
  }
}
