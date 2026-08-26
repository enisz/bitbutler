import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { NgbModalConfig, NgbTooltipConfig } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectConfig } from '@ng-select/ng-select';
import { LangChangeEvent, TranslateService } from '@ngx-translate/core';
import { TimeagoIntl } from 'ngx-timeago';
import { strings as usStrings } from 'ngx-timeago/language-strings/en.js';
import { strings as huStrings } from 'ngx-timeago/language-strings/hu.js';
import { filter, from } from 'rxjs';
import { GeneralSettings } from './models/general-settings.model';
import { CommandBusService } from './services/command-bus.service';
import { ElectronService } from './services/electron.service';
import { GeneralSettingsService } from './services/general-settings.service';
import { MenuBarCommandHandlerService } from './services/menu-bar-command-handler.service';
import { NotificationService } from './services/notification.service';
import { OpenFilesService, PendingAddTorrent } from './services/open-files.service';
import { ServerCommandHandlerService } from './services/server-command-handler.service';
import { ToastService } from './services/toast.service';
import { TorrentCommandHandlerService } from './services/torrent-command-handler.service';
import { TorrentFinishedEvent, TorrentStoreService } from './services/torrent-store.service';
import { TransferLimitCommandHandlerService } from './services/transfer-limit-command-handler.service';
import { UiCommandHandlerService } from './services/ui-command-handler.service';
import { UpdateCommandHandlerService } from './services/update-command-handler.service';
import { WindowService } from './services/window.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
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
  private readonly ngSelectConfigService = inject(NgSelectConfig);
  private readonly toastService = inject(ToastService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly transferLimitcommandHandlerService = inject(TransferLimitCommandHandlerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly serverCommandHandlerService = inject(ServerCommandHandlerService);
  private readonly updateCommandHandlerService = inject(UpdateCommandHandlerService);
  private readonly translateService = inject(TranslateService);
  private readonly timeagoIntl = inject(TimeagoIntl);
  private readonly windowService = inject(WindowService);

  public readonly isDev = toSignal(from(this.electronService.isDev()), { initialValue: false });
  private updateCheckedOnStartup = false;

  // Drafts that have already been checked against the torrent store and routed to the Add
  // Torrent flow. Once routed, a draft is never re-checked - without this, a draft that stays
  // queued while AddTorrent is still finishing up (e.g. post-add renaming/priority calls) would
  // get re-evaluated every time a background maindata poll updates torrentsMap(), and could be
  // misread as "already exists" once the poll picks up the very torrent this draft just added.
  private readonly routedDraftKeys = new Set<string>();

  private draftKey(draft: PendingAddTorrent['draft']): string {
    const hash = draft.torrent?.infoHashV1?.toLowerCase().trim();
    return hash ? `hash:${hash}` : `path:${(draft.originalPath ?? '').trim()}`;
  }

  private readonly _openDraftsEffect = effect(() => {
    const items = this.openFilesService.pendingDrafts();

    if (this.routedDraftKeys.size > 0) {
      const currentKeys = new Set(items.map((item) => this.draftKey(item.draft)));
      for (const key of this.routedDraftKeys) {
        if (!currentKeys.has(key)) this.routedDraftKeys.delete(key);
      }
    }

    const first = items[0];
    if (!first) return;
    if (!this.torrentStoreService.isPrimed()) return;

    const key = this.draftKey(first.draft);
    if (this.routedDraftKeys.has(key)) return;

    const hash = first.draft.torrent?.infoHashV1?.toLowerCase();
    if (hash && this.torrentStoreService.torrentsMap().has(hash)) {
      this.commandBusService.emit({
        type: 'UI_TORRENT_EXISTS',
        hash,
        originalPath: first.draft.originalPath ?? null,
      });
      this.openFilesService.consumeCurrentDraft();
      return;
    }

    this.routedDraftKeys.add(key);
    this.commandBusService.emit({ type: 'UI_ADD_TORRENT' });
  });

  constructor() {
    this.modalConfigService.keyboard = true;
    this.modalConfigService.centered = true;
    this.modalConfigService.animation = true;
    this.tooltipConfigService.container = 'body';
    this.setNgSelectTranslations();

    this.openFilesService.start();
    this.uiCommandHandlerService.start();
    this.menuBarCommandHandlerService.start();
    this.torrentCommandHandlerService.start();
    this.transferLimitcommandHandlerService.start();
    this.serverCommandHandlerService.start();
    this.updateCommandHandlerService.start();

    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: LangChangeEvent) => {
        this.setTimeagoLanguage(event.lang);
        this.setNgSelectTranslations();
        window.bitbutler.i18n.languageChanged(event.lang);
      });

    this.torrentStoreService.finished$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: TorrentFinishedEvent) => {
        const message = this.translateService.instant('app.success.finished-downloading');

        if (this.windowService.state().isMinimized) {
          this.notificationService.send(message, event.torrent.name);
        } else {
          this.toastService.success(event.torrent.name, message);
        }
      });

    this.generalSettingsService
      .asObservable()
      .pipe(
        filter((settings): settings is GeneralSettings => !!settings),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((generalSettings: GeneralSettings) => {
        if (generalSettings?.behavior.automaticUpdate && !this.updateCheckedOnStartup) {
          this.commandBusService.emit({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'automatic' });
          this.updateCheckedOnStartup = true;
        }

        if (generalSettings?.language.language) {
          if (this.translateService.getCurrentLang() !== generalSettings.language.language) {
            this.translateService.use(generalSettings.language.language);
          }
        }
      });
  }

  private setNgSelectTranslations(): void {
    this.ngSelectConfigService.addTagText = this.translateService.instant(
      'general.form.ng-select.add-tag',
    );
    this.ngSelectConfigService.clearAllText = this.translateService.instant(
      'general.form.ng-select.clear-all',
    );
    this.ngSelectConfigService.loadingText = this.translateService.instant(
      'general.form.ng-select.loading',
    );
    this.ngSelectConfigService.notFoundText = this.translateService.instant(
      'general.form.ng-select.not-found',
    );
    this.ngSelectConfigService.typeToSearchText = this.translateService.instant(
      'general.form.ng-select.type-to-search',
    );
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
