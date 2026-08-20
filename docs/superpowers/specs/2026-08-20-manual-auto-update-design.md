# Manual (button-triggered) auto-update

## Context

BitButler already has a lightweight update-check flow: on app startup and via
a "Check for Updates" menu item, the renderer calls
`window.bitbutler.electron.checkForUpdate()`, which hits the GitHub Releases
REST API directly from the main process (`packages/electron/src/ipc/electron.ts`),
compares the latest non-draft/non-prerelease tag against `app.getVersion()`,
and - if newer releases exist - shows the `UpdateAvailable` modal
(`packages/app/src/app/modals/update-available/`) with a changelog accordion
and per-platform "Download" buttons that just open the asset URL in the
system browser (`shell.openExternal`). There is no in-app download or
install today; the user always finishes the update manually.

This spec adds real in-app auto-update - triggered only by an explicit
"Update Now" click in that same modal's footer, never automatically - using
`electron-updater`. Nothing about the existing check/changelog/manual-download
flow changes; `electron-updater` is added purely as the engine behind the new
button.

## Goals

- A user who already sees the "update available" modal can click one button
  ("Update Now") to download and install the update, with the app quitting
  and restarting on its own once the download finishes - no separate
  download/install confirmation steps.
- Zero update-related network calls happen without an explicit user click
  (this already holds for the existing check flow; it must continue to hold
  for the new download/install path too - `autoDownload` and
  `autoInstallOnAppQuit` are explicitly `false`).
- Works for the Windows NSIS-installed build and the Linux AppImage build.
  Package types that `electron-updater` cannot update in place (Windows
  portable/zip, Linux deb/rpm/snap/tar.gz) fall back to the existing
  manual-download experience with no broken button shown.
- Windows builds are unsigned until SignPath is wired up separately; the UI
  proactively warns that SmartScreen may interrupt the automatic install.

## Out of scope

- Any change to the existing GitHub-REST check flow, the changelog UI, or the
  per-asset manual "Download" buttons.
- Code signing itself.
- Auto-check-on-startup changes (the existing automatic check already only
  fetches release metadata, never a binary - that behavior is unchanged and
  not part of this spec).

## Main process (`packages/electron/src/updater.ts`, new file)

Wraps `electron-updater`'s `autoUpdater`:

```ts
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
```

Two IPC handlers, registered from a `registerUpdaterIpcHandlers()` function
called alongside the other `register*IpcHandlers()` calls at startup:

- **`updater:get-capability`** -> `{ supported: boolean }`. Determines
  whether this running install can actually be updated in place:
  - **Linux**: `supported` only if `process.env.APPIMAGE` is set (set by the
    AppImage runtime; absent for deb/rpm/snap/tar.gz).
  - **Windows**: `supported` only if `Update.exe` exists next to
    `process.execPath` (`fs.existsSync(path.join(path.dirname(process.execPath), 'Update.exe'))`).
    NSIS installs place this file next to the app exe for its own
    uninstaller/updater plumbing; it is absent for the portable exe and for a
    zip extraction, so this single check covers both unsupported Windows
    variants.
  - **Dev mode** (`!app.isPackaged`): always `false`.
- **`updater:update-now`** -> runs the full chain in one call:
  1. `autoUpdater.checkForUpdates()`.
  2. If no update is actually available (e.g. race between the modal opening
     and the click), emit an `error` event with a friendly message and stop -
     do not call `downloadUpdate()`.
  3. `autoUpdater.downloadUpdate()`.
  4. On the `update-downloaded` event, wait ~1.2s (so the renderer has a
     moment to show a "restarting..." message) then `autoUpdater.quitAndInstall()`.

  Every relevant `autoUpdater` event (`checking-for-update`, `download-progress`,
  `update-downloaded`, `error`) is forwarded to the renderer over a single
  `webContents.send('updater:event', ...)` channel as a small tagged union.
  All handlers wrap in try/catch; raw error objects/stacks are reduced to a
  plain `message` string before crossing the IPC boundary.

Code comment on the Windows path noting that unsigned NSIS installers can be
blocked or delayed by SmartScreen even when launched programmatically by
`quitAndInstall()`, not just on a user-initiated double-click - so a
"stuck" or failed automatic install on Windows is an expected risk until
SignPath signing lands, not necessarily a bug.

## Shared types (`@bitbutler/shared`)

Added to `packages/shared/src/models/electron.model.ts` (or a sibling
`updater.model.ts`, re-exported from `packages/shared/src/index.ts`):

```ts
export interface UpdateCapability {
  supported: boolean;
}

export type UpdaterEvent =
  | { status: 'checking' }
  | { status: 'downloading'; percent: number; transferred: number; total: number }
  | { status: 'downloaded' }
  | { status: 'error'; message: string };
```

`BitButlerAPI` (`packages/shared/src/ipc.types.ts`) gets a new `updater`
namespace:

```ts
updater: {
  getCapability(): Promise<UpdateCapability>;
  updateNow(): Promise<void>;
  onEvent(callback: (event: UpdaterEvent) => void): () => void;
};
```

## Preload (`packages/electron/src/preload.ts`)

```ts
updater: {
  getCapability: () => ipcRenderer.invoke('updater:get-capability'),
  updateNow: () => ipcRenderer.invoke('updater:update-now'),
  onEvent: (callback) =>
    makeIpcSubscription('updater:event', (e) => e as UpdaterEvent, callback),
},
```

Follows the existing `makeIpcSubscription` pattern already used for
`window`/`export` events - no direct `ipcRenderer` exposure.

## Angular (`packages/app`)

### `UpdaterService` (new, `providedIn: 'root'`)

Thin wrapper around the preload API, not a full replacement for
`UpdateCommandHandlerService`/`UpdateSettingsService` (those keep owning
"is there an update" / "which version was skipped"). Exposes signals:

- `capability = signal<UpdateCapability | null>(null)` - populated by calling
  `getCapability()` once, lazily, the first time it's read (or eagerly in the
  constructor; implementation detail for the plan).
- `status = signal<'idle' | 'checking' | 'downloading' | 'downloaded' | 'error'>('idle')`
- `progress = signal<number>(0)` - percent, from `download-progress` events.
- `errorMessage = signal<string | null>(null)`

A single `onEvent` subscription is set up in the constructor (torn down via
`DestroyRef`) and updates these signals. A public `updateNow(): void` method
resets `status`/`progress`/`errorMessage` and calls
`window.bitbutler.updater.updateNow()`.

### `UpdateAvailable` modal (`packages/app/src/app/modals/update-available/`)

Footer changes (`update-available.html`, alongside the existing "Skip this
version" / "Close" buttons):

- **"Update Now" button** - shown only when
  `updaterService.capability()?.supported` is `true`. While
  `status() === 'downloading'`, the button is replaced by a progress bar
  driven by `progress()`. While `status() === 'downloaded'`, it's replaced by
  a short "Restarting to install..." line. On `status() === 'error'`, the
  button re-enables and a toast fires (title "Update Failed", message = the
  error), matching `UpdateCommandHandlerService`'s existing pattern for
  check failures.
- **"Skip this version" and "Close" are disabled once "Update Now" is
  clicked**, re-enabled only if the flow errors out. The download/install
  runs in the main process independent of whether the modal stays open, so
  once it's started, letting the user close the modal would mean the app
  could quit-and-restart later with no visible warning; locking the modal
  open avoids that surprise.
- **Windows SmartScreen callout**: when `capability()?.supported` is `true`
  and `platform() === 'win32'` (platform is already fetched today via
  `electronService.getPlatform()` in this component), a `bb-callout`
  (`variant="warning"`) is shown above the "Update Now" button:
  "Windows may show a SmartScreen warning during installation, since
  BitButler isn't code-signed yet. If the update doesn't finish
  automatically, download and run the installer manually below." No
  equivalent callout on Linux.
- Where `capability()?.supported` is `false` (Linux non-AppImage, Windows
  portable/zip, dev mode), no "Update Now" button and no callout appear -
  just the existing manual per-asset "Download" buttons, unchanged.

## Build config & CI

Required for the feature to function at all, not optional polish:

- Root `package.json` `build.publish`: currently `null` -> set to
  `{ "provider": "github", "owner": "enisz", "repo": "bitbutler" }`. This
  only controls where `electron-updater` looks for its own feed file
  (`latest.yml` / `latest-linux.yml`); it is unrelated to the existing direct
  GitHub-REST changelog call, which keeps working as-is.
- `electron-updater` added to root `dependencies` (not
  `packages/electron/package.json`) - matching where `axios` and
  `better-sqlite3`, the other main-process runtime deps, already live in this
  workspace.
- `.github/workflows/release.yml`, `electron-pack` job: change
  `npx electron-builder ${{ matrix.target }}` to
  `npx electron-builder ${{ matrix.target }} --publish never`. With a
  `publish` config now present, electron-builder generates `latest.yml`
  (Windows) / `latest-linux.yml` (Linux) plus a `.blockmap` file for the NSIS
  target as local build output; `--publish never` stops it from also
  attempting to auto-publish itself, which would need its own `GH_TOKEN` in
  that job and would race the existing manual upload step.
- `publish-release` job: extend the `files:` glob in the "Upload release
  assets" step to also include `dist-electron/latest.yml`,
  `dist-electron/latest-linux.yml`, and `dist-electron/*.exe.blockmap`.
  Without these landing in the GitHub Release, `checkForUpdates()` has
  nothing to read and every "Update Now" click fails.

## Testing

A real published release with `latest.yml`/`latest-linux.yml` present is
needed for true end-to-end verification. Before that's available:
`electron-builder --publish=never` output can be served from a local static
file server and pointed at via `electron-updater`'s `dev-app-update.yml`
override, with a temporarily-lowered local version number to trigger
"update available." Unit tests cover the capability-detection logic (env
var / file-existence branches, mocked), the IPC handler's event forwarding
and error sanitization, and the `UpdaterService`/modal signal wiring. The PR
description will note how it was tested and flag that a real tagged
GitHub release is needed from the maintainer for final confirmation, per the
project's existing pattern for changes that depend on the release pipeline.
