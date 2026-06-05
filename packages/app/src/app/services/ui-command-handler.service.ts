import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { About } from '../components/about/about';
import { AddTorrent } from '../components/add-torrent/add-torrent';
import { AppLoader } from '../components/app-loader/app-loader';
import { DeleteTorrent } from '../components/modals/delete-torrent/delete-torrent';
import { ManageCategories } from '../components/modals/manage-categories/manage-categories';
import { ManageServers } from '../components/modals/manage-servers/manage-servers';
import { ManageTags } from '../components/modals/manage-tags/manage-tags';
import { RenameTorrent } from '../components/modals/rename-torrent/rename-torrent';
import { ServerEditor } from '../components/modals/server-editor/server-editor';
import { SetTorrentCategory } from '../components/modals/set-torrent-category/set-torrent-category';
import { SetTorrentLocation } from '../components/modals/set-torrent-location/set-torrent-location';
import { SetTorrentTags } from '../components/modals/set-torrent-tags/set-torrent-tags';
import { ShareLimit } from '../components/modals/share-limit/share-limit';
import { TorrentDetails } from '../components/modals/torrent-details/torrent-details';
import { TransferLimit } from '../components/modals/transfer-limit/transfer-limit';
import { UpdateAvailable } from '../components/modals/update-available/update-available';
import { AppCommand, UiCommand } from '../models/command.model';
import { GuardableModal } from '../models/guardable-modal.interface';
import { QbTorrentContent } from '../models/torrent.model';
import { QbSettings } from '../pages/qb-settings/qb-settings';
import { Settings } from '../pages/settings/settings';
import { setModalInput } from '../utils/modal-input';
import { CommandBusService } from './command-bus.service';
import { ElectronService } from './electron.service';
import { PathService } from './path.service';
import { QbService } from './qb.service';
import { SelectionStoreService } from './selection-store.service';
import { ServerStoreService } from './server-store.service';
import { ServerService } from './server.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class UiCommandHandlerService {
  private readonly modalService = inject(NgbModal);
  private readonly commandBusService = inject(CommandBusService);
  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly pathService = inject(PathService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly serverService = inject(ServerService);
  private readonly electronService = inject(ElectronService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);

  private activeModals: NgbModalRef[] = [];

  public start(): void {
    this.modalService.activeInstances
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((modals) => (this.activeModals = modals));

    const unsubBbe = window.bitbutler.window.onOpenBbe((bbePath) => {
      this.commandBusService.emit({ type: 'UI_IMPORT_TORRENTS', bbePath });
    });
    this.destroyRef.onDestroy(unsubBbe);

    void window.bitbutler.window.drainOpenBbe().then((paths) => {
      if (paths[0]) this.commandBusService.emit({ type: 'UI_IMPORT_TORRENTS', bbePath: paths[0] });
    });

    this.commandBusService.commands$
      .pipe(filter(this.uiCommandGuard), takeUntilDestroyed(this.destroyRef))
      .subscribe((command: AppCommand) => {
        switch (command.type) {
          case 'UI_TORRENT_DELETE_REQUEST':
            if (this.selectionStoreService.selected().length === 0) return;
            if (this.isModalOpen(DeleteTorrent)) break;

            const deleteModalRef = this.modalService.open(DeleteTorrent);
            setModalInput(deleteModalRef, 'defaultRemoveFiles', command.defaultRemoveFiles);

            deleteModalRef.result
              .then(({ removeFiles }) =>
                this.commandBusService.emit({ type: 'TORRENT_DELETE_CONFIRM', removeFiles }),
              )
              .catch(() => {});
            break;

          case 'UI_OPEN_SETTINGS': {
            if (this.isModalOpen(Settings)) break;
            const settingsModalRef = this.modalService.open(Settings, {
              size: 'xl',
              centered: false,
              scrollable: true,
              beforeDismiss: () => settingsModalRef.componentInstance.canDeactivate(),
            });

            if (command.tabToOpen) {
              setModalInput(settingsModalRef, 'tabToOpen', command.tabToOpen);
            }

            settingsModalRef.result.catch(() => {});
            break;
          }

          case 'UI_OPEN_QB_SETTINGS': {
            if (this.isModalOpen(QbSettings)) break;
            const qbSettingsModalRef = this.modalService.open(QbSettings, {
              size: 'xl',
              centered: false,
              scrollable: true,
              beforeDismiss: () => qbSettingsModalRef.componentInstance.canDeactivate(),
            });
            qbSettingsModalRef.result.catch(() => {});
            break;
          }

          case 'UI_OPEN_TORRENT_DETAILS': {
            if (!command.hash) return;
            if (this.isModalOpen(TorrentDetails)) break;

            const torrentDetailsModalRef = this.modalService.open(TorrentDetails, {
              size: 'xl',
              scrollable: true,
              centered: false,
              beforeDismiss: () =>
                (torrentDetailsModalRef.componentInstance as GuardableModal).canDeactivate(),
            });
            setModalInput(torrentDetailsModalRef, 'hash', command.hash);
            torrentDetailsModalRef.result.catch(() => {});
            break;
          }

          case 'UI_ADD_TORRENT': {
            if (this.isModalOpen(AddTorrent)) break;
            const addTorrentModalRef = this.modalService.open(AddTorrent, {
              size: 'lg',
              scrollable: true,
              centered: false,
              keyboard: false,
            });

            if (command.mode === 'link') {
              addTorrentModalRef.componentInstance.switchInputMode('link');
            }

            addTorrentModalRef.result.catch(() => {});
            break;
          }

          case 'UI_OPEN_ABOUT': {
            if (this.isModalOpen(About)) break;
            const aboutModalRef = this.modalService.open(About);
            aboutModalRef.result.catch(() => {});
            break;
          }

          case 'UI_RENAME_TORRENT': {
            if (!command.torrent) return;
            if (this.isModalOpen(RenameTorrent)) break;

            const renameModalRef = this.modalService.open(RenameTorrent, {
              size: 'lg',
              centered: true,
            });

            setModalInput(renameModalRef, 'torrent', command.torrent);
            renameModalRef.result.catch(() => {});
            break;
          }

          case 'UI_SET_TORRENT_LOCATION': {
            if (!command.torrent) return;
            if (this.isModalOpen(SetTorrentLocation)) break;

            const setLocationModalRef = this.modalService.open(SetTorrentLocation, {
              size: 'lg',
              centered: true,
            });

            setModalInput(setLocationModalRef, 'torrent', command.torrent);
            setLocationModalRef.result.catch(() => {});
            break;
          }

          case 'UI_LIMIT_TRANSFER': {
            if (this.isModalOpen(TransferLimit)) break;
            const transferHashes =
              command.hashes ??
              (command.target === 'torrent' ? this.selectionStoreService.selectedHashes() : []);
            const limitTransferModalRef = this.modalService.open(TransferLimit, {
              centered: true,
              size: 'lg',
            });
            setModalInput(limitTransferModalRef, 'target', command.target);
            setModalInput(limitTransferModalRef, 'hashes', transferHashes);
            limitTransferModalRef.result.catch(() => {});
            break;
          }

          case 'UI_LIMIT_SHARE': {
            if (this.isModalOpen(ShareLimit)) break;
            const shareLimitTarget = command.target ?? 'torrent';
            const shareLimitHashes =
              command.hashes ??
              (shareLimitTarget === 'torrent' ? this.selectionStoreService.selectedHashes() : []);
            const limitTorrentShare = this.modalService.open(ShareLimit, { size: 'lg' });
            setModalInput(limitTorrentShare, 'target', shareLimitTarget);
            setModalInput(limitTorrentShare, 'hashes', shareLimitHashes);
            limitTorrentShare.result.catch(() => {});
            break;
          }

          case 'UI_SET_TORRENT_TAGS': {
            if (this.isModalOpen(SetTorrentTags)) break;
            const setTagsModalRef = this.modalService.open(SetTorrentTags, { size: 'lg' });
            setModalInput(setTagsModalRef, 'torrent', command.torrent);
            setTagsModalRef.result.catch(() => {});
            break;
          }

          case 'UI_SET_TORRENT_CATEGORY': {
            if (this.isModalOpen(SetTorrentCategory)) break;
            const setCategoryModalRef = this.modalService.open(SetTorrentCategory, { size: 'lg' });
            setModalInput(setCategoryModalRef, 'torrent', command.torrent);
            setCategoryModalRef.result.catch(() => {});
            break;
          }

          case 'UI_OPEN_DESTINATION':
            if (!command.remotePath) {
              this.toastService.danger('Remote Path not provided!');
              break;
            }

            Promise.all([
              this.qbService.torrentContents(
                this.serverStoreService.currentServerId() as string,
                command.hash,
              ),
              this.pathService.resolveLocalPath(command.remotePath),
            ])
              .then(([contents, path]: [QbTorrentContent[], string | null]) => {
                const singleFile = contents.length === 1;

                if (!path) {
                  this.toastService.danger('Could not resolve local path!');
                  return;
                }

                if (singleFile) {
                  this.electronService.showItemInFolder(path);
                  this.toastService.info('Showing file in folder ' + path);
                } else {
                  this.electronService.openPath(path);
                  this.toastService.info('Opening folder ' + path);
                }
              })
              .catch((error: any) => {
                this.toastService.danger(error);
              });
            break;

          case 'UI_SERVER_EDITOR_OPEN': {
            if (this.isModalOpen(ServerEditor)) break;
            const serverEditorModalRef = this.modalService.open(ServerEditor, { size: 'lg' });
            setModalInput(serverEditorModalRef, 'id', command.id);
            serverEditorModalRef.result
              .then((newId: string) =>
                this.commandBusService.emit({ type: 'SERVER_ADDED', id: newId }),
              )
              .catch(() => {});
            break;
          }

          case 'UI_UPDATE_AVAILABLE': {
            if (this.isModalOpen(UpdateAvailable)) break;
            const updateAvailableModalRef = this.modalService.open(UpdateAvailable, {
              size: 'lg',
              centered: true,
              scrollable: true,
            });
            updateAvailableModalRef.componentInstance.update.set(command.update);
            updateAvailableModalRef.result.catch(() => {});
            break;
          }

          case 'UI_RENAME_FILES': {
            if (!command.hash) return;
            if (this.isModalOpen(TorrentDetails)) break;

            const contentModalRef = this.modalService.open(TorrentDetails, {
              size: 'xl',
              scrollable: true,
              centered: false,
              beforeDismiss: () =>
                (contentModalRef.componentInstance as GuardableModal).canDeactivate(),
            });
            setModalInput(contentModalRef, 'hash', command.hash);
            setModalInput(contentModalRef, 'tabToOpen', 'content');
            setModalInput(contentModalRef, 'context', { editMode: true });
            contentModalRef.result.catch(() => {});
            break;
          }

          case 'UI_MANAGE_TAGS': {
            if (this.isModalOpen(ManageTags)) break;
            const manageTagsModalRef = this.modalService.open(ManageTags, {
              beforeDismiss: () => manageTagsModalRef.componentInstance.canDeactivate(),
            });
            manageTagsModalRef.result.catch(() => {});
            break;
          }

          case 'UI_MANAGE_CATEGORIES': {
            if (this.isModalOpen(ManageCategories)) break;
            const manageCategoriesModalRef = this.modalService.open(ManageCategories, {
              beforeDismiss: () => manageCategoriesModalRef.componentInstance.canDeactivate(),
            });
            manageCategoriesModalRef.result.catch(() => {});
            break;
          }

          case 'UI_MANAGE_SERVERS': {
            if (this.isModalOpen(ManageServers)) break;
            const manageServersModalRef = this.modalService.open(ManageServers);
            manageServersModalRef.result.catch(() => {});
            break;
          }

          case 'UI_SERVER_SWITCH':
            this.handleServerSwitch(command.id);
            break;

          case 'UI_EXPORT_TORRENTS':
            // TODO: open ExportTorrents modal (Task 11)
            console.log('[BitButler] UI_EXPORT_TORRENTS command received');
            break;

          case 'UI_IMPORT_TORRENTS':
            // TODO: open ImportTorrents modal (Task 12)
            console.log('[BitButler] UI_IMPORT_TORRENTS command received', command.bbePath);
            break;

          default:
            console.warn(UiCommandHandlerService.name, 'start', 'Unhandled UI command', command);
        }
      });
  }

  private async handleServerSwitch(serverId: string): Promise<void> {
    const server = this.serverStoreService.servers().find((s) => s.id === serverId);
    const name = server?.name || '';

    this.toastService.info(
      this.translateService.instant('services.menu-bar-command-handler.info.switching-server', {
        name,
      }),
    );

    const appLoaderModal = this.modalService.open(AppLoader, { size: 'sm', centered: true });
    setModalInput(
      appLoaderModal,
      'title',
      this.translateService.instant('services.menu-bar-command-handler.app-loader.title'),
    );
    setModalInput(
      appLoaderModal,
      'message',
      this.translateService.instant('services.menu-bar-command-handler.app-loader.message', {
        name,
      }),
    );

    try {
      const hasSession = await this.qbService.hasCookie(serverId);

      if (!hasSession) {
        const loginRes = await this.qbService.login(serverId);
        if (!loginRes.loggedIn) {
          throw new Error('Login failed');
        }
      }

      this.serverStoreService.select(serverId);
    } catch (err) {
      console.error(
        UiCommandHandlerService.name,
        'handleServerSwitch',
        'Failed to switch servers',
        err,
      );
      this.toastService.danger(
        this.translateService.instant('services.menu-bar-command-handler.error.failed-to-connect', {
          name,
        }),
      );
      this.serverService.setActive(this.serverStoreService.currentServerId());
    } finally {
      appLoaderModal.close();
    }
  }

  private uiCommandGuard(cmd: AppCommand): cmd is UiCommand {
    return cmd.type.startsWith('UI_');
  }

  private isModalOpen(component: any): boolean {
    return this.activeModals.some((modal) => modal.componentInstance instanceof component);
  }
}
