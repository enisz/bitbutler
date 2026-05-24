# Codebase Simplification - Design Spec

**Date:** 2026-05-24
**Scope:** Full codebase - all 297 TypeScript files across all packages

## Goal

Run a full simplification pass across the BitButler repository. Improve code clarity, remove redundancy, eliminate unnecessary abstractions, and clean up verbose patterns - without changing any behavior or architecture.

## Approach

Four parallel agents, each focused on a distinct scope:

### Agent 1 - `packages/app/`

Covers the Angular renderer: components, pages, services, directives, and models that contain substantive code. This is the largest scope (~260 files).

Focus areas:

- Verbose signal/computed patterns that can be tightened
- Redundant type assertions or unnecessary casts
- Overly verbose template logic that can be simplified
- Unused imports or dead code

### Agent 2 - `packages/electron/`

Covers the Electron main process: IPC handlers in `src/ipc/`, `db.ts`, `i18n.ts`, `preload.ts`, and any utilities.

Focus areas:

- IPC handler verbosity
- Repeated patterns across handlers that could be consolidated
- Unnecessary intermediate variables

### Agent 3 - `packages/shared/`

Small package (6 files) but high-impact - it defines the IPC contract and shared models used by both renderer and main process.

Focus areas:

- Type definitions that are more complex than necessary
- Redundant or overlapping types
- Anything that can be expressed more concisely

### Agent 4 - Re-export audit (`packages/app/src/app/models/`)

Several model files in the app package are thin wrappers that simply re-export types from `@bitbutler/shared`:

- `server.model.ts` - 1 line
- `electron.model.ts` - 8 lines
- `torrent-draft.model.ts` - 6 lines

This agent eliminates these files and updates all import sites to import directly from `@bitbutler/shared`, unless it finds a concrete reason to keep a specific file (e.g. the file also adds app-local types, or removal would break the build).

## Constraints

- **No behavior changes** - all functionality must be preserved exactly
- **No architectural changes** - the IPC boundary, command bus pattern, routing, and theming structure stay as-is
- **No test file rewrites** - test files are only touched if the test itself (not the code under test) is the source of complexity
- **No new features** - this is a cleanup pass only
- **Zero lint warnings** - the project enforces `max-warnings=0`; all changes must pass `npm run lint`

## Success Criteria

- `npm run lint` passes with zero warnings
- `npm test` passes across all workspaces
- `npm run build` succeeds
- No behavioral or API surface changes
