# Lazy-Load Modal Components

**Date:** 2026-06-26
**Status:** Approved

## Goal

Remove all modal component classes from the main bundle by converting their static imports to inline dynamic `import()` calls at each `modalService.open()` call site. This reduces initial parse/execute cost at startup. No change to user-visible behaviour.

## What stays in the main bundle

`AppLoader` remains a static import in every file that uses it. It is shown during startup and server-switch flows before any async work can complete, so it must be available synchronously.

## Pattern

Replace a static top-level import + synchronous `modalService.open()` with an inline `await import()` immediately before the `open()` call. The containing method becomes `async` if it is not already.

```typescript
// Before
import { DeleteTorrent } from '../modals/delete-torrent/delete-torrent';
// ...
const ref = this.modalService.open(DeleteTorrent);

// After
// (no top-level import)
// ...
const { DeleteTorrent } = await import('../modals/delete-torrent/delete-torrent');
const ref = this.modalService.open(DeleteTorrent);
```

`isModalOpen()` checks that guard against duplicate modals still work: the class reference returned by a repeated dynamic import of the same module is identical (module cache), so the identity comparison inside `isModalOpen()` remains correct.

No loading indicator is shown while a bundle is fetched. In Electron, chunks load from local disk in under ~50 ms; showing `AppLoader` for that window would cause a visible flicker worse than no indicator.

## Files to change

### `packages/app/src/app/services/ui-command-handler.service.ts`

The `subscribe` callback in `start()` becomes `async`. All static modal imports at the top of the file are removed and replaced with inline `await import()` before each corresponding `modalService.open()` call. `AppLoader` import stays.

Modals to lazy-load (19 unique components, 20 call sites - `TorrentDetails` is opened twice for different commands):
`About`, `AddTorrent`, `DeleteTorrent`, `ExportTorrents`, `ImportTorrents`, `ManageCategories`, `ManageServers`, `ManageTags`, `RenameTorrent`, `ServerEditor`, `SetTorrentCategory`, `SetTorrentLocation`, `SetTorrentTags`, `ShareLimit`, `TorrentDetails`, `TransferLimit`, `UpdateAvailable`, `Settings`, `QbSettings`

### `packages/app/src/app/services/confirm.service.ts`

`confirm()` already returns a `Promise<boolean>`, so it becomes `async`. Static `Confirm` import is replaced with inline `await import()`.

### `packages/app/src/app/pages/login/login.ts`

`CredentialPrompt` and `ManageServers` are lazy-loaded. `AppLoader` stays static. The two methods that open those modals become `async`.

### `packages/app/src/app/components/add-torrent/add-torrent.ts`

`TorrentExists` is lazy-loaded. The two methods that open it become `async`.

### `packages/app/src/app/components/modals/import-torrents/import-torrents.ts`

`QbSettings` is lazy-loaded. The method that opens it becomes `async`.

### `packages/app/src/app/components/modals/manage-servers/manage-servers.ts`

`ServerEditor` is lazy-loaded. The method that opens it becomes `async`.

## Test impact

Making subscribe callbacks and methods `async` means assertions that were previously synchronous now need to wait for the dynamic import promise to resolve before `modalService.open()` is called.

- Any test that emits a command and immediately asserts on `mockModalService.open` without `await flushPromises()` will start failing. Add `await flushPromises()` before those assertions.
- No changes to mock setup are needed: `vi.mock()` at module level intercepts both static and dynamic imports in Vitest. `modalService.open` is already fully mocked, so the actual component class is imported but not exercised.
- Tests in `add-torrent.spec.ts` that assert `expect(modalService.open).toHaveBeenCalledWith(TorrentExists, ...)` continue to work because Vitest caches modules - the class reference from the spec's static import and from the component's dynamic import are the same object.

Affected spec files:

- `packages/app/src/app/services/ui-command-handler.service.spec.ts`
- `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`
- `packages/app/src/app/components/modals/import-torrents/import-torrents.spec.ts` (if it tests the QbSettings open)
- `packages/app/src/app/components/modals/manage-servers/manage-servers.spec.ts` (if it tests the ServerEditor open)
- `packages/app/src/app/services/confirm.service.spec.ts`

## Out of scope

- Loading indicator during bundle fetch
- Polling-pause when a modal is open (future feature - unaffected by this change; `NgbModal.activeInstances` works the same regardless of how components are loaded)
- Preloading/prefetching modal bundles in the background
