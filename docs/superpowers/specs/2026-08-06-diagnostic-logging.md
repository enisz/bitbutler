# Diagnostic Logging - Spec

## Problem

Since #262, every `console.log/info/warn/error/debug` call in the Electron main process and the Angular renderer is persisted to the `logs` table in SQLite (see `packages/electron/src/logger.ts`: main-process console methods are monkey-patched in `initLogger()`, renderer console messages are captured via `webContents.on('console-message', ...)` in `hookRenderer()`). Before #262, `console.*` calls were only useful for someone watching the terminal/devtools live, so a lot of high-value diagnostic events were never logged at all, or only surfaced as an ephemeral UI toast. Now that logs are durable and queryable, those gaps are worth closing.

## Scope

Add targeted `console.info/warn/error/debug` calls (no new abstractions, no logging framework) at the following points, identified by an investigation of `packages/electron/src` and `packages/app/src`:

1. `packages/electron/src/ipc/qbittorrent.ts` - `qbLogin` success/failure, `qbRequest` HTTP failures, `qbTorrentsAdd` submission counts, `decryptPassword` failures.
2. `packages/electron/src/ipc/server.ts` - `serverAdd`/`serverUpdate`/`serverDelete` outcomes, `encryptPassword` unavailability.
3. `packages/electron/src/main.ts` - app startup/quit/second-instance lifecycle; move `initLogger()` earlier so the single-instance-lock quit path is captured too.
4. `packages/electron/src/ipc/export.ts` - the 18 silent `.catch(() => {})` sites in `restoreCategoriesAndTags` and `applyTorrentSettings`, and the `buildExportEntry` per-torrent failure path.
5. `packages/electron/src/ipc/torrent.ts` - `walkSubdirectory` skipped-directory logging (low priority, included since the user asked for all findings).
6. `packages/app/src/app/pages/login/login.ts` - `connect()` failure catch.
7. `packages/app/src/app/modals/manage-servers/manage-servers.ts` - `switchTo()` failure catch.
8. `packages/app/src/app/services/ui-command-handler.service.ts` - `UI_OPEN_DESTINATION` failure catch.
9. `packages/app/src/app/services/torrent-command-handler.service.ts` - `handleToggleSequentialDownload`/`handleToggleFirstLastPiecePrio`, which are missing the `console.error` call every sibling handler already has.
10. `packages/app/src/app/services/qb-polling.service.ts` - distinguish a session-expired (401/403) background-poll failure from other failures in the existing log line.

## Non-goals

- No new logging framework/abstraction - use `console.*` directly, matching the existing codebase convention (see `packages/electron/src/ipc/electron.ts`'s `console.error('Update check failed:', ...)` and `packages/electron/src/ipc/window.ts`'s `console.error('[BitButler][open-files] ...', e)` patterns).
- Never log credentials (passwords) - server logging must only include id/host, never username/password.
- Don't add tests that don't already have a natural seam. This codebase does not unit-test every `console.*` call (e.g. `electron.ts`'s update-check failure and `window.ts`'s open-files failures have no dedicated test). Where a test already exercises the exact failure branch being touched, extend it with a `console.*` spy assertion; don't invent new integration scaffolding solely to assert on a log line.

## Conventions to follow

- Main process log lines: `console.<level>('[BitButler][<module>] <message>.', ...details)`, matching `electron.ts`/`window.ts`.
- Renderer log lines: `console.error(<ClassName>.name, '<methodName>', '<message>', error)`, matching the existing pattern in `login.ts:241`, `ui-command-handler.service.ts:527-532`, and `torrent-command-handler.service.ts:92-97`.
