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
          this.showDebugToast('primary', 'Primary');
          break;

        case 'debug.toast.secondary':
          this.showDebugToast('secondary', 'Secondary');
          break;

        case 'debug.toast.success':
          this.showDebugToast('success', 'Success');
          break;

        case 'debug.toast.danger':
          this.showDebugToast('danger', 'Error');
          break;

        case 'debug.toast.warning':
          this.showDebugToast('warning', 'Warning');
          break;

        case 'debug.toast.info':
          this.showDebugToast('info', 'Info');
          break;

        case 'debug.toast.light':
          this.showDebugToast('light', 'Light');
          break;

        case 'debug.toast.dark':
          this.showDebugToast('dark', 'Dark');
          break;

        case 'debug.toast.adaptive':
          this.showDebugToast(this.toastService.adaptiveType(), 'Adaptive');
          break;

        case 'debug.toast.random': {
          const types = TOAST_TYPES;
          const type = types[Math.floor(Math.random() * types.length)];
          this.showDebugToast(type, 'Random Toast', 'A random toast from debug menu', 5000);
          break;
        }

        case 'debug.toast.all':
          this.showDebugToast('primary', 'Primary', 'This is a primary system message.');
          this.showDebugToast('secondary', 'Secondary', 'This is a secondary system message.');
          this.showDebugToast(
            'light',
            'Light Notification',
            'This message uses the light theme styling.',
          );
          this.showDebugToast(
            'dark',
            'Dark Notification',
            'This message uses the dark theme styling.',
          );
          this.showDebugToast(
            this.toastService.adaptiveType(),
            'Adaptive Mode',
            'This automatically matches your current light/dark mode.',
          );
          this.showDebugToast('success', 'Success', 'The operation was completed successfully.');
          this.showDebugToast('danger', 'Error', 'A critical failure occurred during the process.');
          this.showDebugToast('warning', 'Warning', 'Please review your inputs before continuing.');
          this.showDebugToast('info', 'Info', 'There is a new update available for your profile.');
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
      this.showDebugToast(
        type,
        `${type[0].toUpperCase()}${type.slice(1)} with actions`,
        loremIpsum,
        undefined,
        this.debugToastActions(),
      );
    }
  }

  // Debug toasts only exercise the in-app toast, so they never raise an OS notification.
  private showDebugToast(
    type: ToastType,
    title: string,
    message = loremIpsum,
    duration?: number,
    actions?: ToastAction[],
  ): void {
    this.toastService.showText(message, { type, title, duration, actions, notifyOs: false });
  }

  private debugToastActions(): ToastAction[] {
    const clicked = (label: string) => () =>
      this.showDebugToast('info', 'Debug', `Action clicked: ${label}`, 2000);

    return [
      { label: 'Retry', kind: 'primary', onClick: clicked('Retry') },
      { label: 'Close', kind: 'text', onClick: clicked('Close') },
    ];
  }

  private handleServerSwitch(serverId: string): void {
    if (!serverId) return;
    if (this.serverStoreService.currentServerId() === serverId) return;
    this.commandBusService.emit({ type: 'UI_SERVER_SWITCH', id: serverId });
  }
}
