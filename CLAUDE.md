# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is BitButler

BitButler is a cross-platform **Electron desktop app** for managing remote qBittorrent-nox instances. It uses **Angular 20** (zoneless, signal-based) for the frontend and communicates with the Electron main process exclusively via IPC.

## Monorepo structure

This is an **npm workspaces** monorepo. All packages live under `packages/`:

| Package               | Path                 | Purpose                            |
| --------------------- | -------------------- | ---------------------------------- |
| `@bitbutler/app`      | `packages/app/`      | Angular renderer                   |
| `@bitbutler/electron` | `packages/electron/` | Electron main process (TypeScript) |
| `@bitbutler/shared`   | `packages/shared/`   | Shared IPC contract & models       |
| `@bitbutler/docs`     | `packages/docs/`     | VitePress documentation site       |

A single `npm ci` at the root installs all workspace dependencies. Workspace packages that depend on each other are symlinked automatically by npm.

## Commands

```bash
npm start               # Angular dev server + tsc:watch + Electron hot reload (concurrent)
npm run serve           # Angular dev server only
npm run lint            # ESLint (max-warnings=0 - zero warnings allowed)
npm run lint:fix        # Auto-fix lint issues
npm run format          # Prettier format entire codebase
npm test                # Run tests across all workspaces
npm run build           # Angular production build
npm run build:electron  # Compile Electron TypeScript
npm run build:ui        # Full UI build (Angular + Electron, production)
npm run serve:docs      # VitePress dev server for the docs site
npm run build:docs      # Build the docs site
npm run dist:linux      # Build Linux distributions (AppImage, DEB, RPM, Snap, tar.gz)
npm run dist:win        # Build Windows distributions (NSIS, portable, ZIP)
```

Pre-commit hooks (Husky + lint-staged) enforce linting and formatting automatically on commit.

## Architecture

### Process separation

```
Angular (renderer) ──→ window.bitbutler.* ──→ packages/electron/src/preload.ts ──→ ipcMain.handle() ──→ packages/electron/src/ipc/*.ts
```

- `packages/electron/src/preload.ts` is the only bridge. It exposes `window.bitbutler` with namespaces: `qb`, `server`, `settings`, `window`, `electron`, `notification`, `torrent`.
- Angular services call `window.bitbutler.*` directly - never `fetch()` or Node APIs.
- `packages/electron/src/ipc/qbittorrent.ts` proxies all qBittorrent API calls via **axios** from the main process (avoids CORS and handles HTTP streaming for maindata).
- `packages/electron/src/db.ts` holds a **better-sqlite3** database: `servers` table (passwords encrypted with Electron `safeStorage`) and `settings` table (JSON blobs).

### Shared types (`@bitbutler/shared`)

The `packages/shared` package is the single source of truth for the IPC contract and shared models:

- `packages/shared/src/ipc.types.ts` - the canonical `BitButlerAPI` interface
- `packages/shared/src/models/` - `ServerModel`, `ElectronModel`, `TorrentDraftModel`, `WindowModel`

Both `packages/app` and `packages/electron` import from `@bitbutler/shared`. Angular model files re-export from shared; there is no type duplication across the IPC boundary.

### Angular state & data flow

- **Signals** are the primary reactive primitive (Angular 20 zoneless mode). Use `signal()`, `computed()`, `effect()` - not `BehaviorSubject` for new state.
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

- Themes live in `packages/app/src/styles/themes/` (multiple SCSS files); `ThemeService` switches them at runtime.
- Translations in `public/i18n/` (`us.json`, `hu.json`), loaded via `@ngx-translate` in Angular and via `packages/electron/src/i18n.ts` in the Electron main process. Language is persisted in `GeneralSettingsService`; changing it triggers a `bitbutler:language-change` IPC call that rebuilds the tray and application menu labels at runtime.

## Toasts

- Toast title = a short, specific, Title-Case description of the outcome
  ("Tag Added", "Failed to Resume Torrent") - never the calling component's
  name, never just the severity level.
- Toast message = the variable detail only (a quoted name/path, or the raw
  caught error), or, if there's no detail, one short sentence-case
  confirmation ending in a period. Never restate what the title already
  says.
- Exception: a transient "action in progress" toast (e.g. "Resuming the
  torrent…") keeps the default level title and a full sentence as its
  message - this rule applies to terminal success/error toasts only.
- Skip the toast entirely for actions whose result is already visible
  in the UI (e.g. a grid row reordering, a checkbox toggling) - add one
  only when something happened that the user can't otherwise see, or when
  it can fail.

## Writing style

- Use `-` (hyphen) instead of `—` (em dash) in all written output: responses, PR descriptions, commit messages, and documentation.

## Commit & PR conventions

- Commit format: `#IssueID: short description` (e.g. `#22: add file tree checkboxes`) - applies to commits within a feature branch.
- PR description must include `Fixes #IssueID` to auto-close the issue on merge.
- PR title must be a clean description only - do not include the issue ID in the title.
- Issue titles are clean descriptions only - no `[TYPE]:` prefix; the label (applied automatically by the issue template) conveys the type.
- When squash-merging a PR, accept GitHub's default commit message (`<PR title> (#<PR number>)`) - do not manually prepend the issue ID.
- Labels are applied automatically by a GitHub workflow - do not add them manually.
- `maintenance` and `chore` labeled PRs are excluded from the release-notes changelog (and the in-app "What's new" modal) via release-drafter `exclude-labels`.
- CI runs lint → tests → cross-platform builds on every PR.

## Git workflow

- **Feature branches:** Use the pattern `<issue-id>-<dash-separated-summary>` (e.g. `100-manage-labels-and-categories`).
- **Issue templates:** When opening new issues, use the appropriate template from `.github/ISSUE_TEMPLATE/`. `gh issue create` does NOT auto-apply a template's `labels:` field in non-interactive mode - pass `--label <label>` explicitly matching the chosen template (e.g. `--label maintenance` for `04_maintenance.yml`, `--label bug` for `01_bug_report.yml`, etc.).
- **PR template:** ALWAYS read `.github/pull_request_template.md` before running `gh pr create` and use it as the exact structure for `--body`. Do not invent a different format.

## Specs & plans (docs folder)

- `superpowers` skill specs/plans live under `docs/superpowers/specs/` and `docs/superpowers/plans/` on the feature branch.
- Committing them to the remote feature branch is fine - it allows resuming implementation from a different machine.
- They must not be merged to main: remove the `docs` folder in its own commit (e.g. `#<id>: removed spec and plan`) once implementation is done, before opening or merging the PR.
- Do not reference or link spec/plan files or paths in PR or issue descriptions.
