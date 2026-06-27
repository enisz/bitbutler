# Logging Design

**Date:** 2026-06-27
**Status:** Approved

## Goal

Add file-based logging to BitButler that captures output from both the Electron main process and the Angular renderer into a single log file, with no changes required to existing application code.

## Approach

Use `electron-log` in the main process with:

- `log.initialize()` to transparently override `console.*` in the main process
- `webContents.on('console-message')` to capture all renderer console output
- Global uncaught exception handlers for the main process

## Log File

- **Location:** `app.getPath('logs')` - platform standard path
  - Linux: `~/.config/bitbutler/logs/main.log`
  - Windows: `%APPDATA%\bitbutler\logs\main.log`
  - macOS: `~/Library/Logs/bitbutler/main.log`
- **Rotation:** max 10 MB per file, 3 archived files kept, rotate on startup if over limit
- **Format per line:** `[YYYY-MM-DD HH:mm:ss.SSS] [main|renderer] [level] message`

## Log Levels

All levels are captured (none filtered out). The `console-message` event's numeric level is mapped to strings:

| Number | String |
| ------ | ------ |
| 0      | debug  |
| 1      | info   |
| 2      | warn   |
| 3      | error  |

## New File

### `packages/electron/src/logger.ts`

Single module owning all logging setup. Exports:

- `initLogger()` - called once at startup in `main.ts` before anything else. Does:
  1. Configures `electron-log` file transport (path, rotation, format)
  2. Calls `log.initialize()` to override `console.*` in the main process globally
  3. Registers `process.on('uncaughtException')` - logs at error level with full stack, then re-throws
  4. Registers `process.on('unhandledRejection')` - logs at error level with full stack, then re-throws

- `hookRenderer(window: BrowserWindow)` - called after `createMainWindow()`. Attaches `window.webContents.on('console-message', ...)` which:
  - Maps the numeric level to a string (`debug/info/warn/error`)
  - Writes the entry via `electron-log` with `[renderer]` process tag
  - Appends `(sourceId:line)` to the message for source traceability

- `log` - re-export of the `electron-log` logger instance, for any new main-process code that wants to call `log.info(...)` directly

## Changes to Existing Files

### `packages/electron/src/main.ts`

- Import and call `initLogger()` at the very top, before all other imports that could log
- Call `hookRenderer(mainWindow)` immediately after `createMainWindow()` returns

### `packages/electron/package.json`

- Add `electron-log` to `dependencies`

## What Does NOT Change

- Angular app code (`packages/app/`) - zero changes
- `packages/electron/src/preload.ts` - zero changes
- Any existing `console.*` calls in the main process - they write to file automatically after `log.initialize()`
- `provideBrowserGlobalErrorListeners()` in Angular app config - already wired up; uncaught renderer errors flow through `console.error` → `console-message` event → log file

## Renderer Error Coverage

Angular's `provideBrowserGlobalErrorListeners()` catches uncaught errors and unhandled promise rejections in the renderer and calls `console.error` with the full stack trace. This flows naturally into the `console-message` event, so no additional renderer-side error handling is needed.

## Future Work (Out of Scope)

- UI section for log viewing within the app (the existing `electron.openPath` IPC handler can open the log file path when needed)
- Exposing log file path via a dedicated IPC handler
- Log level filtering per environment
