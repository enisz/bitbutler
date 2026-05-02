---
title: 'Architecture'
order: 3
slug: 'architecture'
---

# Architecture

How BitButler is structured internally.

## Process Separation

BitButler is an Electron application consisting of two processes that communicate exclusively through IPC:

- **Renderer process** — the Angular UI. It has no direct access to Node.js APIs or the network.
- **Main process** — the Electron host. It owns the SQLite database, makes all HTTP calls to qBittorrent, and manages the OS window, tray, and notifications.

```
Angular (renderer)
  → window.bitbutler.*
    → preload.ts (contextBridge)
      → ipcMain.handle()
        → electron/ipc/*.ts
```

## IPC Bridge

`preload.ts` is the only bridge between the two processes. It uses Electron's `contextBridge` to expose a typed `window.bitbutler` object with the following namespaces:

### `window.bitbutler.qb`

Login, logout, HTTP proxy to qBittorrent API, maindata sync stream.

### `window.bitbutler.server`

CRUD operations for saved server entries.

### `window.bitbutler.settings`

Read and write arbitrary settings blobs from the SQLite store.

### `window.bitbutler.window`

Window state control, file/torrent drop events, window size.

### `window.bitbutler.electron`

Platform info, external URL opener, file dialogs, update check.

### `window.bitbutler.notification`

Trigger native OS desktop notifications.

### `window.bitbutler.torrent`

Parse .torrent files in the main process.

### `window.bitbutler.menu`

Subscribe to native application menu click events.

## Angular State Management

The app is built on Angular's zoneless mode (no `zone.js`). State is managed with a combination of:

- **Signals** — the primary reactive primitive. `signal()`, `computed()`, and `effect()` are used for all new state. `BehaviorSubject` is avoided.
- **RxJS** — used for async streams such as the maindata polling loop and IPC event subscriptions.
- **Command Bus** — user actions are emitted as typed commands (e.g. `TORRENT_DELETE`) onto a central bus. Dedicated handler services subscribe to commands and perform the work, keeping components free of business logic.

## Key Services

**`TorrentStoreService`**

Central torrent state. Receives maindata chunks from QbPollingService and applies `full_update` or incremental diffs to the signal-based torrent list.

**`QbPollingService`**

Drives the background sync loop. Streams the qBittorrent maindata endpoint and pushes chunks to TorrentStoreService.

**`ServerStoreService`**

Tracks the currently active server. Exposes a `computed()` signal for the current server selection.

**`CommandBusService`**

Central event bus. Components emit typed commands; handler services subscribe and execute the corresponding logic.

**`TorrentCommandHandlerService`**

Handles all `TORRENT_*` commands (delete, rename, move, tag, etc.).

**`UiCommandHandlerService`**

Handles UI commands such as opening modals and dialogs.

**`ServerCommandHandlerService`**

Handles server connect/disconnect and CRUD commands.

**`ThemeService`**

Applies the selected theme class to the document root at runtime.

**`GeneralSettingsService`**

Persists and exposes general app settings (theme, language, auto-update).

## Pages & Routing

The app has three lazy-loaded routes:

- `/pages/login` — Login screen. The router navigates here on 401/403.
- `/pages/main` — Main torrent grid and all torrent actions.
- `/pages/settings` — Settings with General, Servers, Status Bar, and Grid tabs.

## Database

The main process holds a **better-sqlite3** database with two tables:

- **servers** — stores server records. Passwords are encrypted with Electron's `safeStorage` API before being written to disk.
- **settings** — stores arbitrary JSON blobs keyed by a namespace and key, used by all settings services.

## Tech Stack

| Layer       | Technology                           |
| ----------- | ------------------------------------ |
| Frontend    | Angular 20 (zoneless, signals)       |
| Desktop     | Electron                             |
| Build       | Vite + @analogjs/vite-plugin-angular |
| Styling     | SCSS + Bootstrap 5                   |
| Data grid   | ag-Grid                              |
| Database    | SQLite (better-sqlite3)              |
| HTTP client | axios (main process only)            |
| i18n        | @ngx-translate                       |

---

BitButler is open source under the [MIT licence](https://github.com/enisz/bitbutler/blob/main/LICENSE) · [Report an issue](https://github.com/enisz/bitbutler/issues)
