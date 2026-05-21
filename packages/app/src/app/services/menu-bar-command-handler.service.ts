import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { AppLoader } from '../components/app-loader/app-loader';
import { ToastType } from '../models/toast.model';
import { CommandBusService } from './command-bus.service';
import { MenuBarService, MenuClick } from './menu-bar.service';
import { NotificationService } from './notification.service';
import { QbService } from './qb.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

const loremIpsum =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum consequat elementum neque ut rhoncus.';

@Injectable({ providedIn: 'root' })
export class MenuBarCommandHandlerService {
  private readonly menuBarService = inject(MenuBarService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly notificationService = inject(NotificationService);
  private readonly toastService = inject(ToastService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly qbService = inject(QbService);
  private readonly router = inject(Router);
  private readonly modalService = inject(NgbModal);
  private readonly translateService = inject(TranslateService);

  public start(): void {
    this.menuBarService.clicks$.subscribe((payload: MenuClick) => {
      const { action } = payload;

      switch (action) {
        case 'file.addTorrent.file':
          this.commandBusService.emit({ type: 'UI_ADD_TORRENT' });
          break;

        case 'file.addTorrent.link':
          this.commandBusService.emit({ type: 'UI_ADD_TORRENT', mode: 'link' });
          break;

        case 'settings.app':
          this.commandBusService.emit({ type: 'UI_OPEN_SETTINGS' });
          break;

        case 'settings.qb':
          this.commandBusService.emit({ type: 'UI_OPEN_QB_SETTINGS' });
          break;

        case 'file.disconnect':
          this.disconnect();
          break;

        case 'server.add':
          this.commandBusService.emit({ type: 'UI_SERVER_EDITOR_OPEN' });
          break;

        case 'server.select':
          const { serverId } = payload;
          if (serverId) this.handleServerSwitch(serverId);
          break;

        case 'help.checkForUpdates':
          this.commandBusService.emit({ type: 'UPDATE_CHECK_FOR_UPDATE' });
          break;

        case 'help.about':
          this.commandBusService.emit({ type: 'UI_OPEN_ABOUT' });
          break;

        case 'settings.manage-labels':
          this.commandBusService.emit({ type: 'UI_MANAGE_LABELS' });
          break;

        case 'settings.manage-categories':
          this.commandBusService.emit({ type: 'UI_MANAGE_CATEGORIES' });
          break;

        case 'debug.notification':
          this.notificationService.send('Notification Test', 'A notification from the Renderer');
          break;

        case 'debug.toast.primary':
          this.toastService.primary(loremIpsum, 'Primary');
          break;

        case 'debug.toast.secondary':
          this.toastService.secondary(loremIpsum, 'Secondary');
          break;

        case 'debug.toast.success':
          this.toastService.success(loremIpsum, 'Success');
          break;

        case 'debug.toast.danger':
          this.toastService.danger(loremIpsum);
          break;

        case 'debug.toast.warning':
          this.toastService.warning(loremIpsum);
          break;

        case 'debug.toast.info':
          this.toastService.info(loremIpsum);
          break;

        case 'debug.toast.light':
          this.toastService.light(loremIpsum, 'Light');
          break;

        case 'debug.toast.dark':
          this.toastService.dark(loremIpsum, 'Dark');
          break;

        case 'debug.toast.adaptive':
          this.toastService.adaptive(loremIpsum, 'Adaptive');
          break;

        case 'debug.toast.random':
          const types: ToastType[] = [
            'primary',
            'secondary',
            'success',
            'danger',
            'warning',
            'info',
            'light',
            'dark',
          ];
          const type = types[Math.floor(Math.random() * (types.length - 1))];
          this.toastService.showText('A random toast from debug menu', {
            title: 'Random Toast',
            type,
            duration: 5000,
          });
          break;

        case 'debug.toast.all':
          this.toastService.primary('This is a primary system message.', 'Primary');
          this.toastService.secondary('This is a secondary system message.', 'Secondary');
          this.toastService.light(
            'This message uses the light theme styling.',
            'Light Notification',
          );
          this.toastService.dark('This message uses the dark theme styling.', 'Dark Notification');
          this.toastService.adaptive(
            'This automatically matches your current light/dark mode.',
            'Adaptive Mode',
          );
          this.toastService.success('The operation was completed successfully.');
          this.toastService.danger('A critical failure occurred during the process.');
          this.toastService.warning('Please review your inputs before continuing.');
          this.toastService.info('There is a new update available for your profile.');
          break;

        default:
          console.error(
            'MenuBarCommandHandlerService',
            'clicks$',
            'action is not defined!',
            payload,
          );
      }
    });
  }

  private async disconnect(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();

    try {
      await window.bitbutler.window.setOpenFilesEnabled(false);

      if (serverId) {
        await this.qbService.logout(serverId);
      }

      this.serverStoreService.suppressAutoLoginUntilManualConnect();

      this.serverStoreService.clearSelection();

      await this.router.navigate(['/login']);
    } catch (e) {
      console.error('[Main] logout failed', e);

      try {
        await window.bitbutler.window.setOpenFilesEnabled(false);
      } catch {}

      try {
        this.serverStoreService.suppressAutoLoginUntilManualConnect();
        this.serverStoreService.clearSelection();
      } catch {}

      this.router.navigate(['/login']);
    }
  }

  private async handleServerSwitch(serverId: string) {
    if (!serverId) return;
    if (this.serverStoreService.currentServerId() === serverId) return;

    const { name } = this.serverStoreService.servers().find((s) => s.id === serverId) || {
      name: '',
    };

    this.toastService.info(
      this.translateService.instant('services.menu-bar-command-handler.info.switching-server', {
        name,
      }),
    );

    const appLoaderModal = this.modalService.open(AppLoader, { size: 'sm', centered: true });
    appLoaderModal.componentInstance.title = this.translateService.instant(
      'services.menu-bar-command-handler.app-loader.title',
    );
    appLoaderModal.componentInstance.message = this.translateService.instant(
      'services.menu-bar-command-handler.app-loader.message',
      { name },
    );

    try {
      const hasSession = await this.qbService.hasCookie(serverId);

      if (!hasSession) {
        const loginRes = await this.qbService.login(serverId);
        if (!loginRes.loggedIn) {
          throw new Error('Login failed');
        }
      }

      (this.serverStoreService as any).select(serverId);
    } catch (err) {
      console.error(
        MenuBarCommandHandlerService.name,
        'handleServerSwitch',
        '[MenuHandler] Failed to switch servers',
        err,
      );
      this.toastService.danger(
        this.translateService.instant('services.menu-bar-command-handler.error.failed-to-connect', {
          name,
        }),
      );
    } finally {
      appLoaderModal.close();
    }
  }
}
