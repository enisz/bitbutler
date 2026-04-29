import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { filter } from 'rxjs';
import { About } from '../components/about/about';
import { AddTorrent } from '../components/add-torrent/add-torrent';
import { DeleteTorrent } from '../components/modals/delete-torrent/delete-torrent';
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
import { Settings } from '../pages/settings/settings';
import { CommandBusService } from './command-bus.service';
import { ElectronService } from './electron.service';
import { PathService } from './path.service';
import { QbService } from './qb.service';
import { SelectionStoreService } from './selection-store.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class UiCommandHandlerService {
  private readonly modalService = inject(NgbModal);
  private readonly commandBusService = inject(CommandBusService);
  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly pathService = inject(PathService);
  private readonly toastService = inject(ToastService);
  private readonly electronService = inject(ElectronService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);

  private activeModals: NgbModalRef[] = [];

  public start(): void {
    this.modalService.activeInstances
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((modals) => (this.activeModals = modals));

    this.commandBusService.commands$
      .pipe(filter(this.uiCommandGuard), takeUntilDestroyed(this.destroyRef))
      .subscribe((command: AppCommand) => {
        switch (command.type) {
          case 'UI_TORRENT_DELETE_REQUEST':
            if (this.selectionStoreService.selected().length === 0) return;
            if (this.isModalOpen(DeleteTorrent)) break;

            const deleteModalRef = this.modalService.open(DeleteTorrent);
            deleteModalRef.componentInstance.defaultRemoveFiles = command.defaultRemoveFiles;

            deleteModalRef.result
              .then(({ removeFiles }) =>
                this.commandBusService.emit({ type: 'TORRENT_DELETE_CONFIRM', removeFiles }),
              )
              .catch(() => {});
            break;

          case 'UI_OPEN_SETTINGS':
            if (this.isModalOpen(Settings)) break;
            let settingsModalRef: NgbModalRef;
            settingsModalRef = this.modalService.open(Settings, {
              size: 'xl',
              centered: false,
              scrollable: true,
              beforeDismiss: () => settingsModalRef.componentInstance.canDeactivate(),
            });

            if (command.tabToOpen) {
              settingsModalRef.componentInstance.tabToOpen = command.tabToOpen;
            }

            settingsModalRef.result.then(() => {}).catch(() => {});
            break;

          case 'UI_OPEN_TORRENT_DETAILS':
            if (!command.hash) return;
            if (this.isModalOpen(TorrentDetails)) break;

            let torrentDetailsModalRef: NgbModalRef;
            torrentDetailsModalRef = this.modalService.open(TorrentDetails, {
              size: 'xl',
              scrollable: true,
              centered: false,
              beforeDismiss: () =>
                (torrentDetailsModalRef.componentInstance as GuardableModal).canDeactivate(),
            });
            torrentDetailsModalRef.componentInstance.hash = command.hash;

            torrentDetailsModalRef.result.then(() => {}).catch(() => {});
            break;

          case 'UI_ADD_TORRENT':
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

            addTorrentModalRef.result.then(() => {}).catch(() => {});
            break;

          case 'UI_OPEN_ABOUT':
            if (this.isModalOpen(About)) break;
            const aboutModalRef = this.modalService.open(About);
            aboutModalRef.result.then(() => {}).catch(() => {});
            break;

          case 'UI_RENAME_TORRENT':
            if (!command.torrent) return;
            if (this.isModalOpen(RenameTorrent)) break;

            const renameModalRef = this.modalService.open(RenameTorrent, {
              size: 'lg',
              centered: true,
            });

            renameModalRef.componentInstance.torrent = command.torrent;

            renameModalRef.result.then((res: any) => {}).catch((error: any) => {});
            break;

          case 'UI_SET_TORRENT_LOCATION':
            if (!command.torrent) return;
            if (this.isModalOpen(SetTorrentLocation)) break;

            const setLocationModalRef = this.modalService.open(SetTorrentLocation, {
              size: 'lg',
              centered: true,
            });

            setLocationModalRef.componentInstance.torrent = command.torrent;

            setLocationModalRef.result.then((res: any) => {}).catch((error: any) => {});
            break;

          case 'UI_LIMIT_TRANSFER':
            if (this.isModalOpen(TransferLimit)) break;
            const limitTransferModalRef = this.modalService.open(TransferLimit, {
              centered: true,
              size: 'lg',
            });

            limitTransferModalRef.componentInstance.target = command.target;

            limitTransferModalRef.result.then((res: any) => {}).catch((error: any) => {});
            break;

          case 'UI_LIMIT_SHARE':
            if (this.isModalOpen(ShareLimit)) break;

            const limitTorrentShare = this.modalService.open(ShareLimit, { size: 'lg' });

            limitTorrentShare.result.then((res: any) => {}).catch((error: any) => {});
            break;

          case 'UI_SET_TORRENT_TAGS':
            if (this.isModalOpen(SetTorrentTags)) break;
            const setTagsModalRef = this.modalService.open(SetTorrentTags, { size: 'lg' });

            setTagsModalRef.componentInstance.torrent = command.torrent;

            setTagsModalRef.result.then(() => {}).catch(() => {});
            break;

          case 'UI_SET_TORRENT_CATEGORY':
            if (this.isModalOpen(SetTorrentCategory)) break;
            const setCategoryModalRef = this.modalService.open(SetTorrentCategory, { size: 'lg' });

            setCategoryModalRef.componentInstance.torrent = command.torrent;

            setCategoryModalRef.result.then(() => {}).catch(() => {});
            break;

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
              .then((response: [QbTorrentContent[], string | null]) => {
                const singleFile = response[0].length === 1;
                const path = response[1];

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

          case 'UI_SERVER_EDITOR_OPEN':
            if (this.isModalOpen(ServerEditor)) break;
            const serverEditorModalRef = this.modalService.open(ServerEditor, { size: 'lg' });
            serverEditorModalRef.componentInstance.id = command.id;
            serverEditorModalRef.result
              .then((newId: string) =>
                this.commandBusService.emit({ type: 'SERVER_ADDED', id: newId }),
              )
              .catch(() => {});
            break;

          case 'UI_UPDATE_AVAILABLE':
            if (this.isModalOpen(UpdateAvailable)) break;
            const updateAvailableModalRef = this.modalService.open(UpdateAvailable, {
              size: 'lg',
              centered: true,
              scrollable: true,
            });

            updateAvailableModalRef.componentInstance.update.set(command.update);

            updateAvailableModalRef.result.then((res: any) => {}).catch((error: any) => {});
            break;

          case 'UI_RENAME_FILES':
            if (!command.hash) return;
            if (this.isModalOpen(TorrentDetails)) break;

            let contentModalRef: NgbModalRef;
            contentModalRef = this.modalService.open(TorrentDetails, {
              size: 'xl',
              scrollable: true,
              centered: false,
              beforeDismiss: () =>
                (contentModalRef.componentInstance as GuardableModal).canDeactivate(),
            });
            contentModalRef.componentInstance.hash = command.hash;
            contentModalRef.componentInstance.tabToOpen = 'content';
            contentModalRef.componentInstance.context = { editMode: true };

            contentModalRef.result.then(() => {}).catch(() => {});
            break;
          default:
            console.warn(UiCommandHandlerService.name, 'start', 'Unhandled UI command', command);
        }
      });
  }

  private uiCommandGuard(cmd: AppCommand): cmd is UiCommand {
    return cmd.type.startsWith('UI_');
  }

  private isModalOpen(component: any): boolean {
    for (const modal of this.activeModals) {
      if (modal.componentInstance instanceof component) {
        return true;
      }
    }
    return false;
  }
}
