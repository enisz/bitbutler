# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is BitButler

BitButler is a cross-platform **Electron desktop app** for managing remote qBittorrent-nox instances. It uses **Angular 20** (zoneless, signal-based) for the frontend and communicates with the Electron main process exclusively via IPC.

## Commands

```bash
npm start           # Angular dev server + Electron (concurrent)
npm run serve       # Angular dev server only
npm run lint        # ESLint (max-warnings=0 — zero warnings allowed)
npm run lint:fix    # Auto-fix lint issues
npm run format      # Prettier format entire codebase
npm test            # Run tests (no tests written yet)
npm run build       # Angular production build
npm run dist:linux  # Build Linux distributions (AppImage, DEB, RPM, Snap, tar.gz)
npm run dist:win    # Build Windows distributions (NSIS, portable, ZIP)
```

Pre-commit hooks (Husky + lint-staged) enforce linting and formatting automatically on commit.

## Architecture

### Process separation

```
Angular (renderer) ──→ window.bitbutler.* ──→ electron/preload.js ──→ ipcMain.handle() ──→ electron/ipc/*.js
```

- `electron/preload.js` is the only bridge. It exposes `window.bitbutler` with namespaces: `qb`, `server`, `settings`, `window`, `electron`, `notification`, `torrent`.
- Angular services call `window.bitbutler.*` directly — never `fetch()` or Node APIs.
- `electron/ipc/qbittorrent.js` proxies all qBittorrent API calls via **axios** from the main process (avoids CORS and handles HTTP streaming for maindata).
- `electron/db.js` holds a **better-sqlite3** database: `servers` table (passwords encrypted with Electron `safeStorage`) and `settings` table (JSON blobs).

### Angular state & data flow

- **Signals** are the primary reactive primitive (Angular 19+ zoneless mode). Use `signal()`, `computed()`, `effect()` — not `BehaviorSubject` for new state.
- **RxJS** is used for async streams (polling, HTTP streaming); `QbPollingService` drives the background sync loop.
- `TorrentStoreService` is the central torrent state. It receives maindata chunks from `QbPollingService` and applies `full_update` vs incremental diffs.
- `ServerStoreService` tracks the active server selection; `currentServer` is a `computed()` signal.

### Command bus pattern

User actions flow through a typed command bus rather than direct service calls:

```typescript
// Emit from any component:
commandBusService.emit({ type: 'TORRENT_DELETE', ids, deleteFiles });

// Handled in dedicated handler services (started in app.ts):
torrentCommandHandlerService.start(); // subscribes to TORRENT_* commands
```

Handler services are: `UiCommandHandlerService`, `TorrentCommandHandlerService`, `ServerCommandHandlerService`. They subscribe in `app.ts` via `.start()`.

### Routing & pages

Three lazy-loaded routes: `login`, `main` (torrent grid), `settings`. The router navigates to `login` on 401/403 from the qBittorrent API.

### Theming & i18n

- Themes live in `src/styles/themes/` (multiple SCSS files); `ThemeService` switches them at runtime.
- Translations in `public/i18n/` (`us.json`, `hu.json`), loaded via `@ngx-translate`. Language persisted in `GeneralSettingsService`.

## Commit & PR conventions

- Commit format: `#IssueID: short description` (e.g. `#22: add file tree checkboxes`)
- PR description must include `Fixes #IssueID` to auto-close the issue on merge.
- Apply a label to the PR: `bug`, `feature`, `enhancement`, or `maintenance`.
- CI runs lint → tests → cross-platform builds on every PR.
