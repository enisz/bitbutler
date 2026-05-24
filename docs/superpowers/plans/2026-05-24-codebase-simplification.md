# Codebase Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify all 297 TypeScript files in the BitButler monorepo for clarity, reduced redundancy, and cleaner patterns - without changing any behavior.

**Architecture:** Four scoped passes run across `packages/shared/`, `packages/electron/`, `packages/app/`, and a targeted re-export audit of `packages/app/src/app/models/`. Tasks 1-3 run in parallel (they touch non-overlapping file sets). Task 4 runs after Task 1 because the re-export audit modifies files that Task 4 also touches.

**Tech Stack:** Angular 20 (zoneless signals), Electron, TypeScript, npm workspaces, ESLint, Prettier, Jest (via `@angular-builders/jest`).

---

## Execution Order

```
Phase 1 (parallel): Task 1 + Task 2 + Task 3
Phase 2:            Task 4  (after Task 1 completes)
Phase 3:            Task 5  (after all code tasks complete)
```

---

### Task 1: Re-export audit - remove thin wrapper model files

Three model files in `packages/app/src/app/models/` are pure pass-throughs that only re-export types from `@bitbutler/shared`. They add no value and should be eliminated.

**Files to delete:**

- `packages/app/src/app/models/server.model.ts` (1 line)
- `packages/app/src/app/models/electron.model.ts` (8 lines)
- `packages/app/src/app/models/torrent-draft.model.ts` (6 lines)

**Import sites to update (17 files total):**

```
packages/app/src/app/components/add-torrent/add-torrent.spec.ts
packages/app/src/app/components/add-torrent/add-torrent.ts
packages/app/src/app/components/bb-file-tree/bb-file-tree.spec.ts
packages/app/src/app/components/bb-file-tree/bb-file-tree.ts
packages/app/src/app/components/modals/manage-servers/manage-servers.ts
packages/app/src/app/components/modals/server-editor/server-editor.ts
packages/app/src/app/components/modals/torrent-details/content/content.ts
packages/app/src/app/components/modals/update-available/update-available.spec.ts
packages/app/src/app/components/modals/update-available/update-available.ts
packages/app/src/app/models/command.model.ts
packages/app/src/app/pages/login/login.ts
packages/app/src/app/services/electron.service.ts
packages/app/src/app/services/open-files.service.ts
packages/app/src/app/services/path.service.ts
packages/app/src/app/services/server-store.service.spec.ts
packages/app/src/app/services/server-store.service.ts
packages/app/src/app/services/server.service.ts
```

- [ ] **Step 1: Read the three wrapper files to confirm they contain no app-local types**

  Read each file. Confirm each only contains `export type { ... } from '@bitbutler/shared'` and nothing else. If a file adds any app-local type, keep it but remove only the re-exported lines and update callers of those specific types.

  Expected content of `server.model.ts`:

  ```typescript
  export type { NewServer, ServerProtocol, ServerRecord } from '@bitbutler/shared';
  ```

  Expected content of `electron.model.ts`:

  ```typescript
  export type {
    HostPlatform,
    ReactionRollup,
    Release,
    ReleaseAsset,
    SimpleUser,
    UpdateCheckResponse,
  } from '@bitbutler/shared';
  ```

  Expected content of `torrent-draft.model.ts`:

  ```typescript
  export type {
    TorrentDraft,
    TorrentDraftError,
    TorrentDraftSource,
    TorrentFileEntry,
  } from '@bitbutler/shared';
  ```

- [ ] **Step 2: Read each of the 17 import-site files**

  For each file, note the exact import lines that reference `server.model`, `electron.model`, or `torrent-draft.model`.

- [ ] **Step 3: Update imports in all 17 files**

  In each file, replace any import from `'../models/server.model'` (or `'../../models/server.model'` etc. - match the relative depth) with the equivalent import from `'@bitbutler/shared'`. Do the same for `electron.model` and `torrent-draft.model`.

  Example transformation:

  ```typescript
  // Before
  // After
  import type { NewServer, Release, ServerRecord } from '@bitbutler/shared';
  import type { Release } from '../../models/electron.model';
  import type { NewServer, ServerRecord } from '../models/server.model';
  ```

  Consolidate multiple `@bitbutler/shared` imports in the same file into one import statement.

- [ ] **Step 4: Delete the three wrapper files**

  ```bash
  rm packages/app/src/app/models/server.model.ts
  rm packages/app/src/app/models/electron.model.ts
  rm packages/app/src/app/models/torrent-draft.model.ts
  ```

- [ ] **Step 5: Run lint to confirm no broken imports**

  ```bash
  npm run lint
  ```

  Expected: exit 0, zero warnings. If lint reports missing imports, re-check the import paths in the affected files and fix the relative path depth.

- [ ] **Step 6: Run tests**

  ```bash
  npm test
  ```

  Expected: all tests pass. If a test fails with "cannot find module", fix the import in that test file.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/app/src/app/models/ packages/app/src/app/components/ packages/app/src/app/pages/ packages/app/src/app/services/
  git commit -m "#110: Remove thin re-export model wrappers, import directly from @bitbutler/shared"
  ```

---

### Task 2: Simplify packages/shared/ (parallel with Tasks 1 and 3)

The `shared` package is the IPC contract and model source of truth. It has 6 files. Simplify type definitions that are more complex than necessary.

**Files:**

- `packages/shared/src/index.ts`
- `packages/shared/src/ipc.types.ts`
- `packages/shared/src/models/electron.model.ts`
- `packages/shared/src/models/server.model.ts`
- `packages/shared/src/models/torrent-draft.model.ts`
- `packages/shared/src/models/window.model.ts`

- [ ] **Step 1: Read all 6 shared files**

  Read each file in full. Note: `ipc.types.ts` defines the `BitButlerAPI` interface - this is the IPC contract and must not change its public shape.

- [ ] **Step 2: Apply simplifications**

  Look for and fix:
  - Union types that can be expressed more concisely
  - Interface properties using verbose `T | undefined` where `T?` is cleaner (only when semantically identical - `foo?: T` means the key may be absent, `foo: T | undefined` means the key must be present but can be undefined; only change when both sides treat absence and undefined identically)
  - Redundant `export` keywords or unnecessary `type` aliases that duplicate an interface verbatim
  - Comments that describe what the code already clearly states

  Do **not** change any method signatures in `ipc.types.ts` - that is the IPC contract between renderer and main process.

- [ ] **Step 3: Run lint**

  ```bash
  npm run lint
  ```

  Expected: exit 0, zero warnings.

- [ ] **Step 4: Run tests**

  ```bash
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 5: Commit (only if changes were made)**

  ```bash
  git add packages/shared/
  git commit -m "#110: Simplify shared package type definitions"
  ```

  If no meaningful changes were found, skip this commit.

---

### Task 3: Simplify packages/electron/ (parallel with Tasks 1 and 2)

The Electron main process has 28 TypeScript files. Focus on the IPC handlers and larger utility files.

**Files by size (largest first):**

- `packages/electron/src/ipc/qbittorrent.ts` (372 lines)
- `packages/electron/src/ipc/server.ts` (298 lines)
- `packages/electron/src/ipc/window.ts` (229 lines)
- `packages/electron/src/menu.ts` (197 lines)
- `packages/electron/src/preload.ts` (132 lines)
- `packages/electron/src/tray.ts` (116 lines)
- `packages/electron/src/main-window.ts` (104 lines)
- `packages/electron/src/main.ts` (93 lines)
- `packages/electron/src/torrents/parse-torrent.ts` (103 lines)
- All remaining files in `packages/electron/src/ipc/` and `packages/electron/src/`

- [ ] **Step 1: Read all electron source files (not spec files)**

  Read every `.ts` file in `packages/electron/src/` that is not a `.spec.ts` file. Identify:
  - Repeated patterns across IPC handlers (e.g. identical try/catch shapes, identical response wrapping)
  - Unnecessary intermediate `const` variables (single-use variables assigned and immediately returned)
  - Verbose conditional chains that can be expressed with nullish coalescing or optional chaining
  - Unused imports

- [ ] **Step 2: Apply simplifications**

  For each file with improvements, apply them. Examples of valid simplifications:

  ```typescript
  // Before: unnecessary intermediate variable
  const result = await someAsyncOp();
  return result;
  // After:
  return await someAsyncOp();

  // Before: verbose null check
  const value = obj !== null && obj !== undefined ? obj.prop : undefined;
  // After:
  const value = obj?.prop;

  // Before: verbose string concatenation
  const url = protocol + '://' + host + ':' + port;
  // After:
  const url = `${protocol}://${host}:${port}`;
  ```

  Do **not** change:
  - The `ipcMain.handle()` handler names - these are the IPC channel names used by `preload.ts`
  - The shape of objects passed to/from `preload.ts`
  - The `safeStorage` encryption logic in `db.ts`

- [ ] **Step 3: Run lint**

  ```bash
  npm run lint
  ```

  Expected: exit 0, zero warnings.

- [ ] **Step 4: Run tests**

  ```bash
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 5: Commit (only if changes were made)**

  ```bash
  git add packages/electron/
  git commit -m "#110: Simplify Electron main process code"
  ```

  If no meaningful changes were found, skip this commit.

---

### Task 4: Simplify packages/app/ (after Task 1 completes)

The Angular renderer package is the largest scope. Read and simplify services, components, pages, and directives. **Run this task only after Task 1 has been committed**, because Task 1 deletes model files that some of these files import.

**Key files by area:**

Services (largest):

- `packages/app/src/app/services/qb.service.ts` (920 lines)
- `packages/app/src/app/services/ui-command-handler.service.ts` (387 lines)
- `packages/app/src/app/services/torrent-command-handler.service.ts` (253 lines)
- `packages/app/src/app/services/toast.service.ts` (247 lines)
- `packages/app/src/app/services/menu-bar-command-handler.service.ts` (202 lines)
- All other services in `packages/app/src/app/services/`

Pages:

- `packages/app/src/app/pages/login/login.ts` (192 lines)
- All files under `packages/app/src/app/pages/`

Components:

- All files under `packages/app/src/app/components/`

Models (remaining after Task 1):

- `packages/app/src/app/models/qbittorrent.model.ts` (309 lines)
- `packages/app/src/app/models/torrent.model.ts` (167 lines)
- All other model files in `packages/app/src/app/models/`

Other:

- `packages/app/src/app/directives/`
- `packages/app/src/app/app.ts`
- `packages/app/src/app/app.config.ts`
- `packages/app/src/app/app.routes.ts`

- [ ] **Step 1: Read all app source files (not spec files) in batches**

  Read all `.ts` and `.html` files in `packages/app/src/app/` that are not `.spec.ts`. Process in logical batches:
  1. Models
  2. Services
  3. Components
  4. Pages and directives

  For each file, identify:
  - Signal/computed patterns that are overly verbose (Angular 20 zoneless style)
  - `BehaviorSubject` usage that could be a `signal()` (only if clearly an isolated state with no RxJS pipeline dependencies)
  - Type assertions (`as SomeType`) that are unnecessary because TypeScript can already infer the type
  - Unused imports (ESLint will catch these but pre-identify them)
  - Overly verbose object construction where spread or shorthand suffices
  - Single-use variables that exist only to be immediately returned or passed
  - Comments that restate what the code already says

- [ ] **Step 2: Apply simplifications across all app files**

  Apply all identified improvements. Preserve:
  - All `signal()`, `computed()`, `effect()` reactive patterns that are intentional
  - All RxJS streams in `QbPollingService` and `TorrentStoreService` - these handle async polling and incremental diff merging, changing them would risk subtle timing bugs
  - The command bus pattern in `CommandBusService` - do not replace it with direct service calls
  - All `window.bitbutler.*` calls in services - these are the IPC bridge
  - Component `@Input()` / `@Output()` public APIs

- [ ] **Step 3: Run lint**

  ```bash
  npm run lint
  ```

  Expected: exit 0, zero warnings. Fix any lint errors before proceeding.

- [ ] **Step 4: Run tests**

  ```bash
  npm test
  ```

  Expected: all tests pass. If a test fails due to a simplification removing a variable a test was spying on, re-add the variable or adjust the spy to target the underlying call.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/app/
  git commit -m "#110: Simplify Angular app package"
  ```

---

### Task 5: Final validation

Run the full build and test suite to confirm nothing is broken across all packages.

- [ ] **Step 1: Run lint across all packages**

  ```bash
  npm run lint
  ```

  Expected: exit 0, zero warnings.

- [ ] **Step 2: Run all tests**

  ```bash
  npm test
  ```

  Expected: all tests pass across all workspaces.

- [ ] **Step 3: Run production build**

  ```bash
  npm run build
  ```

  Expected: Angular production build succeeds with no errors.

- [ ] **Step 4: Compile Electron TypeScript**

  ```bash
  npm run build:electron
  ```

  Expected: TypeScript compilation succeeds with no errors.

- [ ] **Step 5: If all checks pass, push the branch**

  ```bash
  git push -u origin 110-codebase-simplification-pass
  ```
