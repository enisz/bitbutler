import { Injectable, inject } from '@angular/core';
import { ToastAction, ToastType } from '../models/toast.model';
import { CommandBusService } from './command-bus.service';
import { MenuBarService, MenuClick } from './menu-bar.service';
import { NotificationService } from './notification.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

const loremIpsum =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum consequat elementum neque ut rhoncus.';

const DEBUG_TOAST_ACTIONS_PREFIX = 'debug.toast.actions.';

const TOAST_TYPES: ToastType[] = [
  'primary',
  'secondary',
  'success',
  'danger',
  'warning',
  'info',
  'light',
  'dark',
];

@Injectable({ providedIn: 'root' })
export class MenuBarCommandHandlerService {
  private readonly menuBarService = inject(MenuBarService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly notificationService = inject(NotificationService);
  private readonly toastService = inject(ToastService);
  private readonly serverStoreService = inject(ServerStoreService);

  public start(): void {
    this.menuBarService.clicks$.subscribe((payload: MenuClick) => {
      const { action } = payload;

      if (action.startsWith(DEBUG_TOAST_ACTIONS_PREFIX)) {
        this.showDebugToastsWithActions(action.slice(DEBUG_TOAST_ACTIONS_PREFIX.length));
        return;
      }

      switch (action) {
        case 'file.addTorrent':
          this.commandBusService.emit({ type: 'UI_ADD_TORRENT' });
          break;

        case 'settings.app':
          this.commandBusService.emit({ type: 'UI_OPEN_SETTINGS' });
          break;

        case 'settings.qb':
          this.commandBusService.emit({ type: 'UI_OPEN_QB_SETTINGS' });
          break;

        case 'file.exportTorrents':
          this.commandBusService.emit({ type: 'UI_EXPORT_TORRENTS' });
          break;

        case 'file.importTorrents':
          void window.bitbutler.export.openBbePicker().then((bbePath) => {
            if (bbePath) this.commandBusService.emit({ type: 'UI_IMPORT_TORRENTS', bbePath });
          });
          break;

        case 'file.disconnect':
          this.commandBusService.emit({ type: 'UI_DISCONNECT' });
          break;

        case 'file.quit':
          this.commandBusService.emit({ type: 'UI_QUIT' });
          break;

        case 'server.add':
          this.commandBusService.emit({ type: 'UI_SERVER_EDITOR_OPEN' });
          break;

        case 'server.manage':
          this.commandBusService.emit({ type: 'UI_MANAGE_SERVERS' });
          break;

        case 'server.select': {
          const { serverId } = payload;
          if (serverId) this.handleServerSwitch(serverId);
          break;
        }

        case 'view.select': {
          const { viewId } = payload;
          if (viewId) this.commandBusService.emit({ type: 'UI_VIEW_SELECT', viewId });
          break;
        }

        case 'help.checkForUpdates':
          this.commandBusService.emit({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'manual' });
          break;

        case 'help.about':
          this.commandBusService.emit({ type: 'UI_OPEN_ABOUT' });
          break;

        case 'settings.manage-tags':
          this.commandBusService.emit({ type: 'UI_MANAGE_TAGS' });
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

        case 'debug.toast.random': {
          const types = TOAST_TYPES;
          const type = types[Math.floor(Math.random() * types.length)];
          this.toastService.showText('A random toast from debug menu', {
            title: 'Random Toast',
            type,
            duration: 5000,
          });
          break;
        }

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

  // Debug > Toasts > With Actions: the same kinds as the plain list, each with a secondary and a
  // primary action so the footer layout and per-type colors can be checked.
  private showDebugToastsWithActions(kind: string): void {
    const toastTypes: ToastType[] =
      kind === 'all'
        ? TOAST_TYPES
        : kind === 'random'
          ? [TOAST_TYPES[Math.floor(Math.random() * TOAST_TYPES.length)]]
          : kind === 'adaptive'
            ? [this.toastService.adaptiveType()]
            : TOAST_TYPES.includes(kind as ToastType)
              ? [kind as ToastType]
              : [];

    for (const type of toastTypes) {
      this.toastService.showText(loremIpsum, {
        type,
        title: `${type[0].toUpperCase()}${type.slice(1)} with actions`,
        actions: this.debugToastActions(),
      });
    }
  }

  private debugToastActions(): ToastAction[] {
    const clicked = (label: string) => () =>
      this.toastService.info(`Action clicked: ${label}`, 'Debug', 2000);

    return [
      { label: 'Details', kind: 'text', onClick: clicked('Details') },
      { label: 'Retry', kind: 'primary', onClick: clicked('Retry') },
    ];
  }

  private handleServerSwitch(serverId: string): void {
    if (!serverId) return;
    if (this.serverStoreService.currentServerId() === serverId) return;
    this.commandBusService.emit({ type: 'UI_SERVER_SWITCH', id: serverId });
  }
}
