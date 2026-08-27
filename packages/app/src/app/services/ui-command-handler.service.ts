import { DestroyRef, Injectable, Type, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import {
  catchError,
  combineLatest,
  concatMap,
  filter,
  firstValueFrom,
  map,
  of,
  pairwise,
  startWith,
  timeout,
} from 'rxjs';
import { AppLoader } from '../components/app-loader/app-loader';
import { AppCommand, UiCommand } from '../models/command.model';
import { GuardableModal } from '../models/guardable-modal.interface';
import { QbTorrentContent } from '../models/torrent.model';
import { setModalInput } from '../utils/modal-input';
import { CommandBusService } from './command-bus.service';
import { ConfirmService } from './confirm.service';
import { CredentialPromptService } from './credential-prompt.service';
import { ElectronService } from './electron.service';
import { PathService } from './path.service';
import { QbPollingService } from './qb-polling.service';
import { QbService } from './qb.service';
import { SelectionStoreService } from './selection-store.service';
import { ServerStoreService } from './server-store.service';
import { ServerService } from './server.service';
import { ToastService } from './toast.service';
import { TorrentListGridSettingsService } from './torrent-list-grid.settings.service';

@Injectable({ providedIn: 'root' })
export class UiCommandHandlerService {
  private readonly modalService = inject(NgbModal);
  private readonly commandBusService = inject(CommandBusService);
  private readonly credentialPromptService = inject(CredentialPromptService);
  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly pathService = inject(PathService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly serverService = inject(ServerService);
  private readonly electronService = inject(ElectronService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly torrentListGridSettingsService = inject(TorrentListGridSettingsService);
  private readonly qbPollingService = inject(QbPollingService);
  private readonly confirmService = inject(ConfirmService);
  private readonly router = inject(Router);
  private pauseToken: symbol | null = null;

  private activeModals: NgbModalRef[] = [];

  public start(): void {
    this.modalService.activeInstances
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((modals) => (this.activeModals = modals));

    combineLatest([
      this.modalService.activeInstances.pipe(startWith([] as NgbModalRef[])),
      this.torrentListGridSettingsService.asObservable(),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([modals, settings]) => {
        const shouldPause = modals.length > 0 && settings.pausePollingOnModal;
        if (shouldPause && this.pauseToken === null) {
          this.pauseToken = this.qbPollingService.pause();
        } else if (!shouldPause && this.pauseToken !== null) {
          this.qbPollingService.resume(this.pauseToken);
          this.pauseToken = null;
        }
      });

    this.destroyRef.onDestroy(() => {
      if (this.pauseToken !== null) {
        this.qbPollingService.resume(this.pauseToken);
        this.pauseToken = null;
      }
    });

    const unsubBbe = window.bitbutler.window.onOpenBbe((bbePath) => {
      this.commandBusService.emit({ type: 'UI_IMPORT_TORRENTS', bbePath });
    });
    this.destroyRef.onDestroy(unsubBbe);

    void window.bitbutler.window.drainOpenBbe().then((paths) => {
      if (paths[0]) this.commandBusService.emit({ type: 'UI_IMPORT_TORRENTS', bbePath: paths[0] });
    });

    this.commandBusService.commands$
      .pipe(
        filter(this.uiCommandGuard),
        // Processes one command fully - including its `await import(...)` and isModalOpen()
        // check - before starting the next. commands$ is a plain Subject, so without this a
        // burst of same-type commands (e.g. two UI_ADD_TORRENT in quick succession) could
        // interleave: both would read isModalOpen() as false before either opened its modal,
        // opening two. handleCommand() never rejects, so an error here can't kill the
        // subscription and silently stop all future command handling.
        concatMap((command) => this.handleCommand(command)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private async handleCommand(command: UiCommand): Promise<void> {
    try {
      switch (command.type) {
        case 'UI_TORRENT_DELETE_REQUEST': {
          const deleteHashes = command.hashes ?? this.selectionStoreService.selectedHashes();
          if (deleteHashes.length === 0) return;
          const { DeleteTorrent } = await import('../modals/delete-torrent/delete-torrent');
          if (this.isModalOpen(DeleteTorrent)) break;

          const deleteModalRef = this.modalService.open(DeleteTorrent);
          setModalInput(deleteModalRef, 'defaultRemoveFiles', command.defaultRemoveFiles);
          if (command.hashes) {
            setModalInput(deleteModalRef, 'hashes', command.hashes);
          }

          deleteModalRef.result
            .then(({ removeFiles }) =>
              this.commandBusService.emit({
                type: 'TORRENT_DELETE_CONFIRM',
                removeFiles,
                hashes: command.hashes,
              }),
            )
            .catch(() => {});
          break;
        }

        case 'UI_OPEN_SETTINGS': {
          const { Settings } = await import('../modals/settings/settings');
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
          const { QbSettings } = await import('../modals/qb-settings/qb-settings');
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
          const { TorrentDetails } = await import('../modals/torrent-details/torrent-details');
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
          const { AddTorrent } = await import('../modals/add-torrent/add-torrent');
          if (this.isModalOpen(AddTorrent)) break;
          const addTorrentModalRef = this.modalService.open(AddTorrent, {
            size: 'lg',
            scrollable: true,
            centered: false,
            keyboard: false,
          });

          addTorrentModalRef.result.catch(() => {});
          break;
        }

        case 'UI_OPEN_ABOUT': {
          const { About } = await import('../components/about/about');
          if (this.isModalOpen(About)) break;
          const aboutModalRef = this.modalService.open(About);
          aboutModalRef.result.catch(() => {});
          break;
        }

        case 'UI_RENAME_TORRENT': {
          if (!command.torrent) return;
          const { RenameTorrent } = await import('../modals/rename-torrent/rename-torrent');
          if (this.isModalOpen(RenameTorrent)) break;

          const renameModalRef = this.modalService.open(RenameTorrent, {
            size: 'lg',
            centered: true,
          });

          setModalInput(renameModalRef, 'torrent', command.torrent);
          renameModalRef.result.catch(() => {});
          break;
        }

        case 'UI_SET_SAVE_PATH': {
          if (!command.torrent) return;
          const { SetPath } = await import('../modals/set-path/set-path');
          if (this.isModalOpen(SetPath)) break;

          const setPathModalRef = this.modalService.open(SetPath, {
            size: 'lg',
            centered: true,
          });

          setModalInput(setPathModalRef, 'torrent', command.torrent);
          setModalInput(
            setPathModalRef,
            'hashes',
            command.hashes ?? this.selectionStoreService.selectedHashes(),
          );
          setModalInput(setPathModalRef, 'pathType', 'save');
          setPathModalRef.result.catch(() => {});
          break;
        }

        case 'UI_SET_DOWNLOAD_PATH': {
          const { SetPath } = await import('../modals/set-path/set-path');
          if (this.isModalOpen(SetPath)) break;

          const setPathModalRef = this.modalService.open(SetPath, {
            size: 'lg',
            centered: true,
          });

          setModalInput(setPathModalRef, 'torrent', command.torrent);
          setModalInput(setPathModalRef, 'hashes', command.hashes ?? [command.torrent.hash]);
          setModalInput(setPathModalRef, 'pathType', 'download');
          setPathModalRef.result.catch(() => {});
          break;
        }

        case 'UI_LIMIT_TRANSFER': {
          const { TransferLimit } = await import('../modals/transfer-limit/transfer-limit');
          if (this.isModalOpen(TransferLimit)) break;
          const transferHashes =
            command.hashes ??
            (command.target === 'torrent' ? this.selectionStoreService.selectedHashes() : []);
          const limitTransferModalRef = this.modalService.open(TransferLimit, {
            centered: true,
            size: 'lg',
            beforeDismiss: () =>
              (limitTransferModalRef.componentInstance as GuardableModal).canDeactivate(),
          });
          setModalInput(limitTransferModalRef, 'target', command.target);
          setModalInput(limitTransferModalRef, 'hashes', transferHashes);
          limitTransferModalRef.result.catch(() => {});
          break;
        }

        case 'UI_LIMIT_SHARE': {
          const { ShareLimit } = await import('../modals/share-limit/share-limit');
          if (this.isModalOpen(ShareLimit)) break;
          const shareLimitTarget = command.target ?? 'torrent';
          const shareLimitHashes =
            command.hashes ??
            (shareLimitTarget === 'torrent' ? this.selectionStoreService.selectedHashes() : []);
          const limitTorrentShare = this.modalService.open(ShareLimit, {
            size: 'lg',
            beforeDismiss: () =>
              (limitTorrentShare.componentInstance as GuardableModal).canDeactivate(),
          });
          setModalInput(limitTorrentShare, 'target', shareLimitTarget);
          setModalInput(limitTorrentShare, 'hashes', shareLimitHashes);
          limitTorrentShare.result.catch(() => {});
          break;
        }

        case 'UI_SET_TORRENT_TAGS': {
          const { SetTorrentTags } = await import('../modals/set-torrent-tags/set-torrent-tags');
          if (this.isModalOpen(SetTorrentTags)) break;
          const setTagsModalRef = this.modalService.open(SetTorrentTags, { size: 'lg' });
          setModalInput(setTagsModalRef, 'torrent', command.torrent);
          setModalInput(
            setTagsModalRef,
            'hashes',
            command.hashes ?? this.selectionStoreService.selectedHashes(),
          );
          setTagsModalRef.result.catch(() => {});
          break;
        }

        case 'UI_SET_TORRENT_CATEGORY': {
          const { SetTorrentCategory } =
            await import('../modals/set-torrent-category/set-torrent-category');
          if (this.isModalOpen(SetTorrentCategory)) break;
          const setCategoryModalRef = this.modalService.open(SetTorrentCategory, { size: 'lg' });
          setModalInput(setCategoryModalRef, 'torrent', command.torrent);
          setModalInput(
            setCategoryModalRef,
            'hashes',
            command.hashes ?? this.selectionStoreService.selectedHashes(),
          );
          setCategoryModalRef.result.catch(() => {});
          break;
        }

        case 'UI_OPEN_DESTINATION':
          if (!command.remotePath) {
            this.toastService.danger(
              this.translateService.instant(
                'services.ui-command-handler.error.remote-path-missing',
              ),
            );
            break;
          }

          Promise.all([
            this.qbService.torrents.files(
              this.serverStoreService.currentServerId() as string,
              command.hash,
            ),
            this.pathService.resolveLocalPath(command.remotePath),
          ])
            .then(([contents, path]: [QbTorrentContent[], string | null]) => {
              const singleFile = contents.length === 1;

              if (!path) {
                this.toastService.danger(
                  this.translateService.instant(
                    'services.ui-command-handler.error.local-path-unresolved',
                  ),
                );
                return;
              }

              if (singleFile) {
                this.electronService.showItemInFolder(path);
                this.toastService.info(
                  `"${path}"`,
                  this.translateService.instant(
                    'services.ui-command-handler.info.showing-file-title',
                  ),
                );
              } else {
                this.electronService.openPath(path);
                this.toastService.info(
                  `"${path}"`,
                  this.translateService.instant(
                    'services.ui-command-handler.info.opening-folder-title',
                  ),
                );
              }
            })
            .catch((error: unknown) => {
              console.error(UiCommandHandlerService.name, 'UI_OPEN_DESTINATION', error);
              this.toastService.danger(error instanceof Error ? error.message : String(error));
            });
          break;

        case 'UI_SERVER_EDITOR_OPEN': {
          const { ServerEditor } = await import('../modals/server-editor/server-editor');
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
          const { UpdateAvailable } = await import('../modals/update-available/update-available');
          if (this.isModalOpen(UpdateAvailable)) break;
          const updateAvailableModalRef = this.modalService.open(UpdateAvailable, {
            size: 'lg',
            centered: true,
            scrollable: true,
            beforeDismiss: () => !updateAvailableModalRef.componentInstance.footerLocked(),
          });
          setModalInput(updateAvailableModalRef, 'update', command.update);
          updateAvailableModalRef.result.catch(() => {});
          break;
        }

        case 'UI_RENAME_FILES': {
          if (!command.hash) return;
          const { TorrentDetails } = await import('../modals/torrent-details/torrent-details');
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
          const { ManageTags } = await import('../modals/manage-tags/manage-tags');
          if (this.isModalOpen(ManageTags)) break;
          const manageTagsModalRef = this.modalService.open(ManageTags, {
            scrollable: true,
            beforeDismiss: () => manageTagsModalRef.componentInstance.canDeactivate(),
          });
          manageTagsModalRef.result.catch(() => {});
          break;
        }

        case 'UI_MANAGE_CATEGORIES': {
          const { ManageCategories } =
            await import('../modals/manage-categories/manage-categories');
          if (this.isModalOpen(ManageCategories)) break;
          const manageCategoriesModalRef = this.modalService.open(ManageCategories, {
            scrollable: true,
            beforeDismiss: () => manageCategoriesModalRef.componentInstance.canDeactivate(),
          });
          manageCategoriesModalRef.result.catch(() => {});
          break;
        }

        case 'UI_MANAGE_SERVERS': {
          const { ManageServers } = await import('../modals/manage-servers/manage-servers');
          if (this.isModalOpen(ManageServers)) break;
          const manageServersModalRef = this.modalService.open(ManageServers, {
            scrollable: true,
          });
          manageServersModalRef.result.catch(() => {});
          break;
        }

        case 'UI_SERVER_SWITCH':
          this.handleServerSwitch(command.id);
          break;

        case 'UI_EXPORT_TORRENTS': {
          const { ExportTorrents } = await import('../modals/export-torrents/export-torrents');
          if (this.isModalOpen(ExportTorrents)) break;
          const exportRef = this.modalService.open(ExportTorrents, {
            size: 'lg',
            scrollable: true,
            centered: false,
          });
          exportRef.result.catch(() => {});
          break;
        }

        case 'UI_IMPORT_TORRENTS': {
          const { ImportTorrents } = await import('../modals/import-torrents/import-torrents');
          if (this.isModalOpen(ImportTorrents)) break;
          const importRef = this.modalService.open(ImportTorrents, {
            size: 'xl',
            scrollable: true,
            centered: false,
          });
          if (command.bbePath) {
            setModalInput(importRef, 'initialBbePath', command.bbePath);
          }
          importRef.result.catch(() => {});
          break;
        }

        case 'UI_SCROLL_TO_TORRENT':
          break;

        case 'UI_DISCONNECT': {
          const server = this.serverStoreService.currentServer();
          const confirmed = await this.confirmService.confirm(
            'services.ui-command-handler.disconnect-confirm.title',
            {
              text: 'services.ui-command-handler.disconnect-confirm.message',
              data: { name: server?.name || server?.host || '' },
            },
            'general.button.disconnect',
            undefined,
            undefined,
            faRightFromBracket,
          );
          if (!confirmed) break;

          await this.disconnect();
          break;
        }

        case 'UI_TORRENT_EXISTS': {
          const { TorrentExists } = await import('../modals/torrent-exists/torrent-exists');
          if (this.isModalOpen(TorrentExists)) break;
          const torrentExistsModalRef = this.modalService.open(TorrentExists, {
            centered: true,
          });
          setModalInput(torrentExistsModalRef, 'hash', command.hash);
          setModalInput(torrentExistsModalRef, 'originalPath', command.originalPath);
          torrentExistsModalRef.result.catch(() => {});
          break;
        }

        default:
          console.warn(UiCommandHandlerService.name, 'start', 'Unhandled UI command', command);
      }
    } catch (err) {
      console.error(UiCommandHandlerService.name, 'handleCommand', command.type, err);
    }
  }

  private async handleServerSwitch(serverId: string): Promise<void> {
    const server = this.serverStoreService.servers().find((s) => s.id === serverId);
    const name = server?.name || '';

    this.toastService.info(
      this.translateService.instant('services.menu-bar-command-handler.info.switching-server', {
        name,
      }),
    );

    const openLoader = (): NgbModalRef => {
      const modal = this.modalService.open(AppLoader, { size: 'sm', centered: true });
      setModalInput(
        modal,
        'title',
        this.translateService.instant('services.menu-bar-command-handler.app-loader.title'),
      );
      setModalInput(
        modal,
        'message',
        this.translateService.instant('services.menu-bar-command-handler.app-loader.message', {
          name,
        }),
      );
      return modal;
    };

    let appLoaderModal: NgbModalRef | null = openLoader();

    try {
      const hasSession = await this.qbService.auth.hasCookie(serverId);

      if (!hasSession) {
        let runtimeUsername: string | undefined;
        let runtimePassword: string | undefined;

        if (server && this.credentialPromptService.needsPrompt(server)) {
          appLoaderModal.close();
          appLoaderModal = null;

          const resolved = await this.credentialPromptService.resolve(server);
          if (resolved === null) return;
          runtimeUsername = resolved.username;
          runtimePassword = resolved.password;

          appLoaderModal = openLoader();
        }

        const loginRes = await this.qbService.auth.login(
          serverId,
          runtimeUsername,
          runtimePassword,
        );
        if (!loginRes.loggedIn) {
          throw new Error('Login failed');
        }
      }

      this.serverStoreService.select(serverId);
      await this.waitForInitialLoad();
    } catch (err) {
      console.error(
        UiCommandHandlerService.name,
        'handleServerSwitch',
        'Failed to switch servers',
        err,
      );
      this.toastService.danger(
        `"${name}"`,
        this.translateService.instant(
          'services.menu-bar-command-handler.error.failed-to-connect-title',
        ),
      );
      this.serverService.setActive(this.serverStoreService.currentServerId());
    } finally {
      appLoaderModal?.close();
    }
  }

  private async disconnect(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();

    try {
      await window.bitbutler.window.setOpenFilesEnabled(false);

      if (serverId) {
        await this.qbService.auth.logout(serverId);
      }

      this.serverStoreService.suppressAutoLoginUntilManualConnect();
      this.serverStoreService.clearSelection();

      await this.router.navigate(['/login']);
    } catch (err) {
      console.error(UiCommandHandlerService.name, 'disconnect', 'logout failed', err);

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

  // Waits for the next isInitialLoading$ true -> false transition, i.e. the moment the newly
  // selected server's maindata has fully streamed in (all chunks applied to the torrent store),
  // so the loader keeps masking the old server's torrents until they've actually been replaced.
  // Falls back to a timeout so the loader can't hang forever if a caller ever selects a server
  // that was already active (no new polling cycle, so no true -> false transition ever fires).
  private waitForInitialLoad(): Promise<void> {
    return firstValueFrom(
      this.qbPollingService.isInitialLoading$.pipe(
        pairwise(),
        filter(([wasLoading, isLoading]) => wasLoading && !isLoading),
        map(() => undefined),
        timeout(15000),
        catchError(() => of(undefined)),
      ),
    );
  }

  private uiCommandGuard(cmd: AppCommand): cmd is UiCommand {
    return cmd.type.startsWith('UI_');
  }

  private isModalOpen(component: Type<unknown>): boolean {
    return this.activeModals.some((modal) => modal.componentInstance instanceof component);
  }
}
