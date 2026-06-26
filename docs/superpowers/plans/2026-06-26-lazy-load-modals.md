# Lazy-Load Modal Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all modal component static imports to inline `await import()` calls so they are excluded from the main bundle and fetched on demand.

**Architecture:** Each `modalService.open(Component)` call is preceded by an inline `const { Component } = await import('...')`. The containing method becomes `async`. `AppLoader` is the sole exception - it stays statically imported everywhere it appears. `NgbModal.activeInstances` continues to track all open modals regardless of load mechanism, so no monitoring infrastructure changes.

**Tech Stack:** Angular 20 (zoneless, standalone), `@ng-bootstrap/ng-bootstrap` NgbModal, Vitest

## Global Constraints

- `AppLoader` must remain a static import in every file - never lazy-load it.
- No loading indicator is shown during the async import gap.
- `npm run lint` must pass with zero warnings after each commit.
- `npm test` must pass after each task.
- Commit format: `#186: short description`

---

## File Map

| File                                                                        | Change                                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `packages/app/src/app/services/ui-command-handler.service.ts`               | Remove 19 static modal imports; subscribe callback → `async`; 20 call sites get `await import()`  |
| `packages/app/src/app/services/ui-command-handler.service.spec.ts`          | 9 sync tests → `async` + `await flushPromises()`                                                  |
| `packages/app/src/app/services/confirm.service.ts`                          | `confirm()` → `async`; `Confirm` static import → `await import()`                                 |
| `packages/app/src/app/pages/login/login.ts`                                 | `openManageServers()` and credential-prompt method → `async`; 2 static imports → `await import()` |
| `packages/app/src/app/pages/login/login.spec.ts`                            | 2 sync `openManageServers` tests → `async` + `await`                                              |
| `packages/app/src/app/components/add-torrent/add-torrent.ts`                | `loadDraft()` → `async`; `TorrentExists` static import → `await import()` in 2 call sites         |
| `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`           | 2 sync `TorrentExists` tests → `async` + `await flushPromises()`                                  |
| `packages/app/src/app/components/modals/import-torrents/import-torrents.ts` | `QbSettings` static import → `await import()` in 1 call site; method → `async`                    |
| `packages/app/src/app/components/modals/manage-servers/manage-servers.ts`   | `ServerEditor` static import → `await import()` in 1 call site; method → `async`                  |

---

## Task 1: Lazy-load modals in `ui-command-handler.service.ts`

**Files:**

- Modify: `packages/app/src/app/services/ui-command-handler.service.ts`
- Test: `packages/app/src/app/services/ui-command-handler.service.spec.ts`

**Interfaces:**

- Produces: nothing new — same observable command handling, same public `start()` API

- [ ] **Step 1: Update tests to be async before touching the implementation**

  In `packages/app/src/app/services/ui-command-handler.service.spec.ts`, add `async` and `await flushPromises()` to the 9 tests listed below. The tests at lines 70, 80, and 157 check `.not.toHaveBeenCalled()` after an early return that never reaches any `import()` — leave those synchronous.

  Replace these 9 tests (lines 75–170):

  ```typescript
  it('should open DeleteTorrent modal for UI_TORRENT_DELETE_REQUEST', async () => {
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', defaultRemoveFiles: false });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should not open DeleteTorrent modal when selection is empty and no hashes override is given', () => {
    selectionStore.selectedHashes.set([]);
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', defaultRemoveFiles: false });
    expect(mockModalService.open).not.toHaveBeenCalled();
  });

  it('should open DeleteTorrent modal when hashes are provided even if selection is empty', async () => {
    selectionStore.selectedHashes.set([]);
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', hashes: ['xyz'] });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should forward the hashes override into the emitted TORRENT_DELETE_CONFIRM command', async () => {
    mockModalService.open.mockReturnValueOnce({
      componentInstance: {},
      _contentRef: { componentRef: { setInput: setInputSpy } },
      result: Promise.resolve({ removeFiles: true }),
    });

    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', hashes: ['xyz'] });
    await flushPromises();

    expect(commandBusEmit).toHaveBeenCalledWith({
      type: 'TORRENT_DELETE_CONFIRM',
      removeFiles: true,
      hashes: ['xyz'],
    });
  });

  it('should forward undefined hashes into TORRENT_DELETE_CONFIRM when no override is given', async () => {
    mockModalService.open.mockReturnValueOnce({
      componentInstance: {},
      _contentRef: { componentRef: { setInput: setInputSpy } },
      result: Promise.resolve({ removeFiles: false }),
    });

    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST' });
    await flushPromises();

    expect(commandBusEmit).toHaveBeenCalledWith({
      type: 'TORRENT_DELETE_CONFIRM',
      removeFiles: false,
      hashes: undefined,
    });
  });

  it('should set the hashes input on the DeleteTorrent modal when an override is given', async () => {
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', hashes: ['xyz'] });
    await flushPromises();
    expect(setInputSpy).toHaveBeenCalledWith('hashes', ['xyz']);
  });

  it('should not set the hashes input on the DeleteTorrent modal when no override is given', async () => {
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', defaultRemoveFiles: false });
    await flushPromises();
    const hashesCalls = setInputSpy.mock.calls.filter(([inputName]) => inputName === 'hashes');
    expect(hashesCalls).toHaveLength(0);
  });

  it('should open Settings modal for UI_OPEN_SETTINGS', async () => {
    commands$.next({ type: 'UI_OPEN_SETTINGS' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open QbSettings modal for UI_OPEN_QB_SETTINGS', async () => {
    commands$.next({ type: 'UI_OPEN_QB_SETTINGS' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open About modal for UI_OPEN_ABOUT', async () => {
    commands$.next({ type: 'UI_OPEN_ABOUT' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open AddTorrent modal for UI_ADD_TORRENT', async () => {
    commands$.next({ type: 'UI_ADD_TORRENT' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should not open TorrentDetails when hash is missing for UI_OPEN_TORRENT_DETAILS', () => {
    commands$.next({ type: 'UI_OPEN_TORRENT_DETAILS', hash: null });
    expect(mockModalService.open).not.toHaveBeenCalled();
  });

  it('should open TorrentDetails when hash is provided for UI_OPEN_TORRENT_DETAILS', async () => {
    commands$.next({ type: 'UI_OPEN_TORRENT_DETAILS', hash: 'abc123' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open ServerEditor modal for UI_SERVER_EDITOR_OPEN', async () => {
    commands$.next({ type: 'UI_SERVER_EDITOR_OPEN' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });
  ```

- [ ] **Step 2: Run tests - they must still pass (implementation unchanged)**

  ```bash
  npm test -- --filter=ui-command-handler
  ```

  Expected: all tests pass. If any fail, fix the test before continuing.

- [ ] **Step 3: Convert static imports to dynamic in the service**

  In `packages/app/src/app/services/ui-command-handler.service.ts`, remove the following static import lines at the top:

  ```typescript
  import { About } from '../components/about/about';
  import { AddTorrent } from '../components/add-torrent/add-torrent';
  import { AppLoader } from '../components/app-loader/app-loader';
  // KEEP THIS ONE
  import { DeleteTorrent } from '../components/modals/delete-torrent/delete-torrent';
  import { ExportTorrents } from '../components/modals/export-torrents/export-torrents';
  import { ImportTorrents } from '../components/modals/import-torrents/import-torrents';
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
  import { QbSettings } from '../pages/qb-settings/qb-settings';
  import { Settings } from '../pages/settings/settings';
  ```

  Keep only `AppLoader`:

  ```typescript
  import { AppLoader } from '../components/app-loader/app-loader';
  ```

- [ ] **Step 4: Make the subscribe callback async and add inline imports**

  In `start()`, change `.subscribe((command: AppCommand) => {` to `.subscribe(async (command: AppCommand) => {`.

  Then, in each `case` block, add an `await import()` before the `modalService.open()` call and before any `isModalOpen()` guard that uses the component class. Apply the pattern to all 20 call sites:

  ```typescript
  case 'UI_TORRENT_DELETE_REQUEST': {
    const deleteHashes = command.hashes ?? this.selectionStoreService.selectedHashes();
    if (deleteHashes.length === 0) return;
    const { DeleteTorrent } = await import('../components/modals/delete-torrent/delete-torrent');
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
    const { Settings } = await import('../pages/settings/settings');
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
    const { QbSettings } = await import('../pages/qb-settings/qb-settings');
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
    const { TorrentDetails } = await import('../components/modals/torrent-details/torrent-details');
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
    const { AddTorrent } = await import('../components/add-torrent/add-torrent');
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
    const { RenameTorrent } = await import('../components/modals/rename-torrent/rename-torrent');
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
    const { SetTorrentLocation } = await import('../components/modals/set-torrent-location/set-torrent-location');
    if (this.isModalOpen(SetTorrentLocation)) break;

    const setLocationModalRef = this.modalService.open(SetTorrentLocation, {
      size: 'lg',
      centered: true,
    });

    setModalInput(setLocationModalRef, 'torrent', command.torrent);
    setModalInput(
      setLocationModalRef,
      'hashes',
      command.hashes ?? this.selectionStoreService.selectedHashes(),
    );
    setLocationModalRef.result.catch(() => {});
    break;
  }

  case 'UI_LIMIT_TRANSFER': {
    const { TransferLimit } = await import('../components/modals/transfer-limit/transfer-limit');
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
    const { ShareLimit } = await import('../components/modals/share-limit/share-limit');
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
    const { SetTorrentTags } = await import('../components/modals/set-torrent-tags/set-torrent-tags');
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
    const { SetTorrentCategory } = await import('../components/modals/set-torrent-category/set-torrent-category');
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

  case 'UI_SERVER_EDITOR_OPEN': {
    const { ServerEditor } = await import('../components/modals/server-editor/server-editor');
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
    const { UpdateAvailable } = await import('../components/modals/update-available/update-available');
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
    const { TorrentDetails } = await import('../components/modals/torrent-details/torrent-details');
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
    const { ManageTags } = await import('../components/modals/manage-tags/manage-tags');
    if (this.isModalOpen(ManageTags)) break;
    const manageTagsModalRef = this.modalService.open(ManageTags, {
      beforeDismiss: () => manageTagsModalRef.componentInstance.canDeactivate(),
    });
    manageTagsModalRef.result.catch(() => {});
    break;
  }

  case 'UI_MANAGE_CATEGORIES': {
    const { ManageCategories } = await import('../components/modals/manage-categories/manage-categories');
    if (this.isModalOpen(ManageCategories)) break;
    const manageCategoriesModalRef = this.modalService.open(ManageCategories, {
      beforeDismiss: () => manageCategoriesModalRef.componentInstance.canDeactivate(),
    });
    manageCategoriesModalRef.result.catch(() => {});
    break;
  }

  case 'UI_MANAGE_SERVERS': {
    const { ManageServers } = await import('../components/modals/manage-servers/manage-servers');
    if (this.isModalOpen(ManageServers)) break;
    const manageServersModalRef = this.modalService.open(ManageServers);
    manageServersModalRef.result.catch(() => {});
    break;
  }

  case 'UI_EXPORT_TORRENTS': {
    const { ExportTorrents } = await import('../components/modals/export-torrents/export-torrents');
    if (this.isModalOpen(ExportTorrents)) break;
    const exportRef = this.modalService.open(ExportTorrents, { size: 'lg' });
    exportRef.result.catch(() => {});
    break;
  }

  case 'UI_IMPORT_TORRENTS': {
    const { ImportTorrents } = await import('../components/modals/import-torrents/import-torrents');
    if (this.isModalOpen(ImportTorrents)) break;
    const importRef = this.modalService.open(ImportTorrents, { size: 'lg' });
    if (command.bbePath) {
      setModalInput(importRef, 'initialBbePath', command.bbePath);
    }
    importRef.result.catch(() => {});
    break;
  }
  ```

- [ ] **Step 5: Run lint**

  ```bash
  npm run lint
  ```

  Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Run tests**

  ```bash
  npm test -- --filter=ui-command-handler
  ```

  Expected: all tests pass.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/app/src/app/services/ui-command-handler.service.ts packages/app/src/app/services/ui-command-handler.service.spec.ts
  git commit -m "#186: lazy-load modals in UiCommandHandlerService"
  ```

---

## Task 2: Lazy-load `Confirm` in `confirm.service.ts`

**Files:**

- Modify: `packages/app/src/app/services/confirm.service.ts`
- Test: `packages/app/src/app/services/confirm.service.spec.ts` (no changes needed - all tests already `await service.confirm()`)

**Interfaces:**

- `confirm()` signature is unchanged externally - still returns `Promise<boolean>`

- [ ] **Step 1: Convert `confirm.service.ts`**

  Remove the static import:

  ```typescript
  import { Confirm } from '../components/modals/confirm/confirm';
  ```

  Change `confirm()` to `async` and add the dynamic import before `modalService.open`:

  ```typescript
  public async confirm(
    title: string | ParamWithData,
    message: string | ParamWithData,
    btnOkText: string = 'general.button.ok',
    btnCancelText: string = 'general.button.cancel',
    dialogSize: 'sm' | 'md' | 'lg' | 'xl' = 'md',
    okIcon: IconDefinition = faCheck,
  ): Promise<boolean> {
    const { Confirm } = await import('../components/modals/confirm/confirm');
    const modalRef = this.modalService.open(Confirm, { size: dialogSize });

    if (typeof title !== 'string') {
      setModalInput(modalRef, 'title', title.text);
      setModalInput(modalRef, 'titleParams', title.data);
    } else {
      setModalInput(modalRef, 'title', title);
    }

    if (typeof message !== 'string') {
      setModalInput(modalRef, 'message', message.text);
      setModalInput(modalRef, 'messageParams', message.data);
    } else {
      setModalInput(modalRef, 'message', message);
    }

    setModalInput(modalRef, 'btnOkText', btnOkText);
    setModalInput(modalRef, 'btnCancelText', btnCancelText);
    setModalInput(modalRef, 'okIcon', okIcon);

    return modalRef.result.catch(() => false);
  }
  ```

- [ ] **Step 2: Run lint**

  ```bash
  npm run lint
  ```

  Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Run tests**

  ```bash
  npm test -- --filter=confirm
  ```

  Expected: all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/app/src/app/services/confirm.service.ts
  git commit -m "#186: lazy-load Confirm modal in ConfirmService"
  ```

---

## Task 3: Lazy-load modals in `login.ts`

**Files:**

- Modify: `packages/app/src/app/pages/login/login.ts`
- Test: `packages/app/src/app/pages/login/login.spec.ts`

**Interfaces:**

- `openManageServers()` becomes `async` (was `void`, becomes `Promise<void>`) - template binding still works; Angular handles async event handlers

- [ ] **Step 1: Update the two `openManageServers` tests to be async**

  In `packages/app/src/app/pages/login/login.spec.ts`, locate the `describe('openManageServers')` block and replace both tests:

  ```typescript
  describe('openManageServers', () => {
    it('should open the ManageServers modal', async () => {
      await component.openManageServers();
      expect(modalMock.open).toHaveBeenCalledWith(expect.anything());
    });

    it('should set hideConnect to true on the opened modal', async () => {
      const componentInstance: Record<string, unknown> = {};
      const mockRef = {
        componentInstance,
        _contentRef: {
          componentRef: {
            setInput: vi.fn((name: string, value: unknown) => {
              componentInstance[name] = value;
            }),
          },
        },
      };
      modalMock.open.mockReturnValue(mockRef);
      await component.openManageServers();
      expect(componentInstance['hideConnect']).toBe(true);
    });
  });
  ```

  Note: the first test changes from `toHaveBeenCalledWith(ManageServers)` to `toHaveBeenCalledWith(expect.anything())` because the `ManageServers` static import will be removed from the spec file too. Remove the `import { ManageServers } ...` line from the spec's imports.

- [ ] **Step 2: Run tests - must still pass**

  ```bash
  npm test -- --filter=login
  ```

  Expected: all tests pass.

- [ ] **Step 3: Convert `login.ts`**

  Remove these two static imports:

  ```typescript
  import { CredentialPrompt } from '../../components/modals/credential-prompt/credential-prompt';
  import { ManageServers } from '../../components/modals/manage-servers/manage-servers';
  ```

  Keep `AppLoader`:

  ```typescript
  import { AppLoader } from '../../components/app-loader/app-loader';
  ```

  Find `connect()` (around line 185) - it is already `async`. Add the dynamic import immediately before the `modalService.open(CredentialPrompt)` call:

  ```typescript
  const { CredentialPrompt } =
    await import('../../components/modals/credential-prompt/credential-prompt');
  const credModalRef = this.modalService.open(CredentialPrompt);
  ```

  No method signature change needed for `connect()`.

  Find `openManageServers()` (around line 271) and replace the entire method:

  ```typescript
  public async openManageServers(): Promise<void> {
    const { ManageServers } = await import('../../components/modals/manage-servers/manage-servers');
    const ref = this.modalService.open(ManageServers);
    setModalInput(ref, 'hideConnect', true);
  }
  ```

- [ ] **Step 4: Run lint**

  ```bash
  npm run lint
  ```

  Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Run tests**

  ```bash
  npm test -- --filter=login
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/app/src/app/pages/login/login.ts packages/app/src/app/pages/login/login.spec.ts
  git commit -m "#186: lazy-load CredentialPrompt and ManageServers in Login"
  ```

---

## Task 4: Lazy-load `TorrentExists` in `add-torrent.ts`

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/add-torrent.ts`
- Test: `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`

**Interfaces:**

- `loadDraft()` becomes `private async loadDraft(...)` - callers (Angular effects) do not await it, which is correct: the modal open is a fire-and-forget side effect

- [ ] **Step 1: Update the two synchronous `TorrentExists` tests**

  In `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`, find the test at line 832 (`should open the TorrentExists modal and consume the draft when the torrent is already in the list`) and the test at line 855 (`should pass the draft originalPath to TorrentExists when the torrent is already in the list`). Make both `async` and add `await flushPromises()` after `fixture.detectChanges()`:

  ```typescript
  it('should open the TorrentExists modal and consume the draft when the torrent is already in the list', async () => {
    const torrentStoreService = TestBed.inject(TorrentStoreService) as any;
    torrentStoreService.torrentsArray.set([{ hash: 'ABC123' }]);

    const modalService = TestBed.inject(NgbModal) as any;
    modalService.open.mockReturnValue({ _contentRef: { componentRef: { setInput: vi.fn() } } });

    const draft: TorrentDraft = {
      source: 'manual',
      receivedAt: Date.now(),
      originalPath: '/tmp/movie.torrent',
      torrent: { name: 'Movie', totalSize: 100, infoHashV1: 'abc123', files: [] },
    };

    mockOpenFilesService.pendingDrafts.set([
      { draft, selected: { name: 'movie.torrent', path: '/tmp/movie.torrent' } },
    ]);
    fixture.detectChanges();
    await flushPromises();

    expect(modalService.open).toHaveBeenCalledWith(TorrentExists, { centered: true });
    expect(mockOpenFilesService.consumeCurrentDraft).toHaveBeenCalled();
  });

  it('should pass the draft originalPath to TorrentExists when the torrent is already in the list', async () => {
    const torrentStoreService = TestBed.inject(TorrentStoreService) as any;
    torrentStoreService.torrentsArray.set([{ hash: 'abc123' }]);

    const setInputMock = vi.fn();
    const modalService = TestBed.inject(NgbModal) as any;
    modalService.open.mockReturnValue({
      _contentRef: { componentRef: { setInput: setInputMock } },
    });

    const draft: TorrentDraft = {
      source: 'manual',
      receivedAt: Date.now(),
      originalPath: '/tmp/movie.torrent',
      torrent: { name: 'Movie', totalSize: 100, infoHashV1: 'abc123', files: [] },
    };

    mockOpenFilesService.pendingDrafts.set([
      { draft, selected: { name: 'movie.torrent', path: '/tmp/movie.torrent' } },
    ]);
    fixture.detectChanges();
    await flushPromises();

    expect(setInputMock).toHaveBeenCalledWith('originalPath', '/tmp/movie.torrent');
  });
  ```

  The static `import { TorrentExists }` at the top of the spec stays - the class reference in `toHaveBeenCalledWith` still works because Vitest caches modules.

  Also add `const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));` near the top of the spec file (after the last import, before `describe`). The `add-torrent.spec.ts` file does not currently have this helper.

- [ ] **Step 2: Run tests - must still pass**

  ```bash
  npm test -- --filter=add-torrent
  ```

  Expected: all tests pass.

- [ ] **Step 3: Convert `add-torrent.ts`**

  Remove the static import:

  ```typescript
  import { TorrentExists } from '../modals/torrent-exists/torrent-exists';
  ```

  In `handleSubmit()` (around line 380), replace the synchronous `open` with:

  ```typescript
  if (parsed.name === 'QbHttpError' && parsed.status === 409) {
    const draft = this.effectiveDraft();
    const hash = draft?.torrent?.infoHashV1?.toLowerCase() ?? null;
    const { TorrentExists } = await import('../modals/torrent-exists/torrent-exists');
    const modalRef = this.modalService.open(TorrentExists, { centered: true });
    setModalInput(modalRef, 'hash', hash);
    setModalInput(modalRef, 'originalPath', draft?.originalPath ?? null);
    this.openFilesService.consumeCurrentDraft();
  }
  ```

  `handleSubmit` is already `async` so no signature change is needed there.

  In `loadDraft()` (around line 499), make the method `private async loadDraft(...)` and replace the synchronous `open`:

  ```typescript
  if (this.isAlreadyInList(draft)) {
    const { TorrentExists } = await import('../modals/torrent-exists/torrent-exists');
    const modalRef = this.modalService.open(TorrentExists, { centered: true });
    setModalInput(modalRef, 'hash', draft.torrent?.infoHashV1?.toLowerCase() ?? null);
    setModalInput(modalRef, 'originalPath', draft.originalPath ?? null);
    this.openFilesService.consumeCurrentDraft();
    return;
  }
  ```

- [ ] **Step 4: Run lint**

  ```bash
  npm run lint
  ```

  Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Run tests**

  ```bash
  npm test -- --filter=add-torrent
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/app/src/app/components/add-torrent/add-torrent.ts packages/app/src/app/components/add-torrent/add-torrent.spec.ts
  git commit -m "#186: lazy-load TorrentExists in AddTorrent"
  ```

---

## Task 5: Lazy-load remaining modals (`import-torrents.ts`, `manage-servers.ts`)

**Files:**

- Modify: `packages/app/src/app/components/modals/import-torrents/import-torrents.ts`
- Modify: `packages/app/src/app/components/modals/manage-servers/manage-servers.ts`
- Tests: no test changes needed - neither spec tests these specific modal opens

- [ ] **Step 1: Convert `import-torrents.ts`**

  In `packages/app/src/app/components/modals/import-torrents/import-torrents.ts`, locate the method that opens `QbSettings` (around line 213). Remove the static import:

  ```typescript
  import { QbSettings } from '../../../pages/qb-settings/qb-settings';
  ```

  Make the containing method `async` and add the dynamic import:

  ```typescript
  const { QbSettings } = await import('../../../pages/qb-settings/qb-settings');
  const ref = this.modalService.open(QbSettings, {
    // ... options unchanged
  });
  ```

- [ ] **Step 2: Convert `manage-servers.ts`**

  In `packages/app/src/app/components/modals/manage-servers/manage-servers.ts`, locate the method that opens `ServerEditor` (around line 91). Remove the static import:

  ```typescript
  import { ServerEditor } from '../server-editor/server-editor';
  ```

  Make the containing method `async` and add the dynamic import:

  ```typescript
  const { ServerEditor } = await import('../server-editor/server-editor');
  const ref = this.modalService.open(ServerEditor, { size: 'lg' });
  ```

- [ ] **Step 3: Run lint**

  ```bash
  npm run lint
  ```

  Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Run full test suite**

  ```bash
  npm test
  ```

  Expected: all tests pass across all workspaces.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/app/src/app/components/modals/import-torrents/import-torrents.ts packages/app/src/app/components/modals/manage-servers/manage-servers.ts
  git commit -m "#186: lazy-load QbSettings and ServerEditor in remaining modals"
  ```
