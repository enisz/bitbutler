# Adopt ESLint & typescript-eslint Recommended Rule Sets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn on `eslint.configs.recommended` and `tseslint.configs.recommended` repo-wide, and bring the codebase into compliance — disabling `@typescript-eslint/no-explicit-any` for spec files, and fixing the 156 real `any` usages plus 39 other newly-surfaced violations with real code changes.

**Architecture:** One config-and-mechanical-fixes task (Task 1) turns the rules on and clears every violation _except_ `@typescript-eslint/no-explicit-any` in non-spec source, which is left in place as expected new lint failures. Tasks 2-10 each take a self-contained cluster of files and replace their `any` usages with real types, verified per-task by `npx eslint <files>` reporting zero `@typescript-eslint/no-explicit-any` errors. After Task 1, `npm run lint` will fail (by design, on `no-explicit-any` only) until Task 10 lands — this is expected and each task's own scope should be verified with a scoped eslint run, not a full `npm run lint`.

**Tech Stack:** ESLint 10 flat config, `typescript-eslint` 8.67, `angular-eslint` 22, TypeScript ~6.0, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-22-adopt-eslint-typescript-recommended-rules.md`

## Global Constraints

- Spec files (`**/*.spec.ts`) keep `@typescript-eslint/no-explicit-any` disabled — do not "fix" `any` there.
- The existing `_`-prefixed unused-parameter/variable/catch-binding convention must keep working (handled by rule config in Task 1, not per-site renames).
- No behavior changes beyond what satisfying the new rules requires. Don't refactor beyond the flagged line.
- Every task's deliverable is verified with a **scoped** `npx eslint <its files>` run (zero errors for the rules it owns) plus `npx tsc --noEmit -p packages/app/tsconfig.app.json` (or the relevant package's tsconfig) and the affected `*.spec.ts` file(s) via `npx vitest run <spec path>`.
- Commit format: `#287: <short description>` per repo convention.
- Prefer types already in the codebase: `@bitbutler/shared` models, `ag-grid-community` types (`ICellRendererParams`, `ValueFormatterParams`, `ICellEditorParams`, etc. — grep for how sibling renderers/filters in the same directory already type their `params`), and RxJS/Angular types already imported nearby. Only add a new local `interface`/`type` when nothing existing fits.
- Do not adopt `tseslint.configs.stylistic` — out of scope per the issue (formatting is Prettier's job).

---

### Task 1: Turn on recommended rule sets and fix every non-`any` violation

**Files:**

- Modify: `package.json` (add `@eslint/js` devDependency)
- Modify: `eslint.config.mjs`
- Modify: `packages/app/src/app/app.const.ts`
- Modify: `packages/app/src/app/modals/rename-torrent/rename-torrent.ts`
- Modify: `packages/app/src/app/modals/qb-settings/seeding-ratios/seeding-ratios.ts`
- Modify: `packages/app/src/app/modals/qb-settings/storage/storage.ts`
- Modify: `packages/app/src/app/pages/main/grid/grid.ts`
- Modify: `packages/app/src/app/services/menu-bar-command-handler.service.ts`
- Modify: `packages/app/src/app/modals/torrent-details/peers/flag-cell-renderer/flag-cell-renderer.ts`
- Modify: `packages/app/src/app/pipes/humanize-duration-pipe.ts`
- Modify: `packages/app/src/app/services/context-menu.service.spec.ts`
- Modify: `packages/app/src/app/services/server-store.service.spec.ts`
- Modify: `packages/app/src/app/services/toast.service.spec.ts`
- Modify: `packages/app/src/app/modals/qb-settings/qb-settings.interface.ts`
- Modify: `packages/app/src/app/modals/settings/settings.interface.ts`
- Modify: `packages/app/src/app/modals/torrent-details/torrent-details.interface.ts`
- Modify: `packages/app/src/app/pages/main/grid/grid-keyboard-nav.service.ts`
- Modify: `packages/electron/src/ipc/qbittorrent.ts`
- Modify: `packages/electron/src/ipc/server.ts`
- Modify: `packages/electron/src/main-window.ts`
- Modify: `packages/electron/src/main.ts`

**Interfaces:**

- Produces: the final `eslint.config.mjs` shape that Tasks 2-10 lint against — `packages/app/src/**/*.ts` (excluding `*.spec.ts`) has `@typescript-eslint/no-explicit-any` as `error`; `packages/app/src/**/*.spec.ts` has it `off`.

- [ ] **Step 1: Add the `@eslint/js` devDependency**

```bash
npm install --save-dev @eslint/js@^10.0.1
```

- [ ] **Step 2: Rewrite `eslint.config.mjs`**

Replace the full file content with:

```js
// @ts-check
import js from '@eslint/js';
import angular from 'angular-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import tseslint from 'typescript-eslint';

const noUnusedVarsRules = {
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      args: 'after-used',
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
};

const noEmptyRules = {
  'no-empty': ['error', { allowEmptyCatch: true }],
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/out/**',
      '**/coverage/**',
      '**/.release/**',
      '**/*.min.js',
    ],
  },
  {
    files: ['packages/app/src/**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
      eslintPluginPrettierRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      ...noUnusedVarsRules,
      ...noEmptyRules,
    },
  },
  {
    files: ['packages/app/src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['packages/app/src/**/*.html'],
    extends: [...angular.configs.templateRecommended, eslintPluginPrettierRecommended],
  },
  {
    files: ['packages/electron/src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      eslintPluginPrettierRecommended,
    ],
    rules: {
      ...noUnusedVarsRules,
      ...noEmptyRules,
    },
  },
  {
    files: ['packages/shared/src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      eslintPluginPrettierRecommended,
    ],
    rules: {
      ...noUnusedVarsRules,
      ...noEmptyRules,
    },
  },
  {
    files: ['packages/docs/docs/.vitepress/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    extends: [eslintPluginPrettierRecommended],
  },
);
```

This: adds core-JS + typescript-eslint recommended rules to `app`, `electron`, and `shared`; keeps the existing `_`-prefix convention working via `noUnusedVarsRules`; keeps existing empty-catch cleanup blocks legal via `noEmptyRules`; turns `@typescript-eslint/no-explicit-any` back off for spec files only; and turns on the inline-template lint processor for `app` (currently a no-op — no component uses `template:` today — but future-proofs against one being added).

- [ ] **Step 3: Run a full lint to see the remaining (expected) violations**

Run: `npx eslint . --format json > /tmp/eslint-after-step2.json; echo "exit: $?"`
Expected: non-zero exit. Confirm every reported error's `ruleId` is `@typescript-eslint/no-explicit-any` and every file is either a non-spec file under `packages/app/src` or `packages/electron/src`. Any other rule/file appearing here means a Step 2 mistake — stop and fix before continuing.

- [ ] **Step 4: Fix `no-control-regex` (2 sites) — intentional control-char stripping**

In `packages/app/src/app/app.const.ts`, directly above the `INVALID_FILENAME_CHARS` line:

```ts
// eslint-disable-next-line no-control-regex -- intentionally strips OS-illegal control characters from filenames
export const INVALID_FILENAME_CHARS = /^[^<>:"/\\|?*\x00-\x1f]+$/;
```

In `packages/electron/src/../` — actually this one is in `packages/app/src/app/modals/rename-torrent/rename-torrent.ts`, inside `sanitizeFileName`, directly above the `.replace(/[<>:"/\\|?*\x00-\x1f]/g, '')` line:

```ts
      // eslint-disable-next-line no-control-regex -- intentionally strips OS-illegal control characters from filenames
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
```

- [ ] **Step 5: Fix `no-unused-expressions` (3 sites) — ternaries/comma-expressions used as statements**

In `packages/app/src/app/modals/qb-settings/seeding-ratios/seeding-ratios.ts`, `updateSeedingTimeState`:

```ts
  private updateSeedingTimeState(enabled: boolean): void {
    if (enabled) {
      this.form.controls.max_seeding_time.enable({ emitEvent: false });
    } else {
      this.form.controls.max_seeding_time.disable({ emitEvent: false });
    }
  }
```

In `packages/app/src/app/modals/qb-settings/storage/storage.ts`, `updateTempPathState` — same pattern, `temp_path` instead of `max_seeding_time`:

```ts
  private updateTempPathState(enabled: boolean): void {
    if (enabled) {
      this.form.controls.temp_path.enable({ emitEvent: false });
    } else {
      this.form.controls.temp_path.disable({ emitEvent: false });
    }
  }
```

In `packages/app/src/app/pages/main/grid/grid.ts`, inside `ngAfterViewInit`, replace the comma-expression statement:

```ts
(this.torrentListGridSettingsService
  .asObservable()
  .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
  .subscribe((settings) => this.applyGridSettings(settings)),
  this.translateService.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
    this.refreshColumnHeaders();
  }));
```

with two separate statements:

```ts
this.torrentListGridSettingsService
  .asObservable()
  .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
  .subscribe((settings) => this.applyGridSettings(settings));
this.translateService.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
  this.refreshColumnHeaders();
});
```

- [ ] **Step 6: Fix `no-case-declarations` (3 sites) — brace the `case` bodies**

In `packages/app/src/app/services/menu-bar-command-handler.service.ts`, wrap the body of `case 'server.select':` in braces:

```ts
        case 'server.select': {
          const { serverId } = payload;
          if (serverId) this.handleServerSwitch(serverId);
          break;
        }
```

And wrap the body of `case 'debug.toast.random':` in braces (it has two lexical declarations, `types` and `type`):

```ts
        case 'debug.toast.random': {
          const types: ToastType[] = [
            'primary',
            'secondary',
            'success',
            'danger',
            'warning',
            'info',
            'light',
            'dark',
          ];
          const type = types[Math.floor(Math.random() * (types.length - 1))];
          this.toastService.showText('A random toast from debug menu', {
            title: 'Random Toast',
            type,
          });
          break;
        }
```

Read the surrounding switch statement first to copy the exact rest-of-body content (the snippet above may not be 100% complete — brace exactly what's already there, don't drop or add logic).

- [ ] **Step 7: Fix `prefer-const` (2 sites)**

In `packages/app/src/app/pages/main/grid/grid-keyboard-nav.service.ts` line 88, change `let leadIndex` to `const leadIndex`.
In `packages/electron/src/ipc/qbittorrent.ts` line 361, change `let torrentHashes` to `const torrentHashes`.

- [ ] **Step 8: Fix `preserve-caught-error` (2 sites) — attach `cause` to rethrown errors**

In `packages/electron/src/ipc/server.ts`, both `catch (err) { throw new Error(toUserDbError(err)); }` blocks (around line 227 in the server-add function and line 276 in the server-update function) become:

```ts
  } catch (err) {
    throw new Error(toUserDbError(err), { cause: err });
  }
```

- [ ] **Step 9: Fix `@typescript-eslint/no-empty-object-type` (3 sites) — replace empty marker interfaces with `type X = object`**

In each of `packages/app/src/app/modals/qb-settings/qb-settings.interface.ts`, `packages/app/src/app/modals/settings/settings.interface.ts`, and `packages/app/src/app/modals/torrent-details/torrent-details.interface.ts`, change the trailing empty interface:

```ts
export interface QbSettingsTabComponent {}
```

to:

```ts
export type QbSettingsTabComponent = object;
```

(same pattern for `SettingsTabComponent` and `TorrentDetailTabComponent` respectively — only the name differs). This is verified safe: `class Foo implements SomeTypeAlias` compiles when the alias resolves to `object` (confirmed with a standalone `tsc --strict` check during planning). Every one of these three markers is used as `class X implements <Marker>`, so no call site needs to change.

- [ ] **Step 10: Fix the remaining `@typescript-eslint/no-unused-vars` sites that aren't covered by the `^_` config**

In `packages/app/src/app/modals/torrent-details/peers/flag-cell-renderer/flag-cell-renderer.ts`, the `refresh` method's unused `params` — rename to `_params`:

```ts
  public refresh(params: ICellRendererParams<any, any, any>): boolean {
```

becomes (note: leave the `any`s here for now — Task 5 fixes this file's `no-explicit-any`):

```ts
  public refresh(_params: ICellRendererParams<any, any, any>): boolean {
```

In `packages/app/src/app/pipes/humanize-duration-pipe.ts` line ~41, the unused `catch (e)` — since the `catch` body doesn't reference the binding at all, drop it (optional catch binding):

```ts
try {
  return new DurationFormat(locale, { style }).format(duration);
} catch {
  return new DurationFormat('en-US', { style }).format(duration);
}
```

In `packages/app/src/app/services/context-menu.service.spec.ts`, delete the unused `const firstRef = service['overlayRef'];` line inside the `'should close any existing overlay before opening a new one'` test (confirm it's truly unused first — it is, nothing reads `firstRef` later in that test).

In `packages/app/src/app/services/server-store.service.spec.ts`, delete the unused top-level `const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));` line (confirmed unused anywhere in the file).

In `packages/app/src/app/services/toast.service.spec.ts`, in the `'should escape & in showText()'` test, change:

```ts
const id = service.showText('a & b');
```

to:

```ts
service.showText('a & b');
```

In `packages/electron/src/ipc/server.ts`, delete the unused `const stmtSetAutoLogin = db.prepare<[string]>(...)` line (confirmed dead — no other reference in the file).

In `packages/electron/src/main-window.ts` and `packages/electron/src/main.ts`, remove the vestigial `startMinimized` parameter that `createMainWindow` accepts but never reads (the actual show/maximize decision is made independently in `main.ts`'s `app.whenReady()` handler using its own local `startMinimized` from `getStartupSettings()`):

- `main-window.ts`: change `export function createMainWindow(startMinimized = false): BrowserWindow {` to `export function createMainWindow(): BrowserWindow {`.
- `main.ts`: change `function createOrRestoreMainWindow(startMinimized = false): Electron.BrowserWindow {` to `function createOrRestoreMainWindow(): Electron.BrowserWindow {`, and inside it change `mainWindow = createMainWindow(startMinimized);` to `mainWindow = createMainWindow();`.
- `main.ts`: change the call `const mainWindow = createOrRestoreMainWindow(startMinimized);` to `const mainWindow = createOrRestoreMainWindow();` (the local `startMinimized` variable from `getStartupSettings()` is still used right below it for the `if (!startMinimized)` show/maximize check — don't remove that).

- [ ] **Step 11: Verify Task 1 is fully done**

Run: `npx eslint . --format json > /tmp/eslint-after-task1.json; python3 -c "
import json
data = json.load(open('/tmp/eslint-after-task1.json'))
bad = [(f['filePath'], m['ruleId'], m['line']) for f in data for m in f['messages'] if m.get('ruleId') != '@typescript-eslint/no-explicit-any']
print('non-any violations remaining:', len(bad))
for b in bad: print(b)
"`
Expected: `non-any violations remaining: 0`.

Run: `npx tsc --noEmit -p packages/app/tsconfig.app.json && npx tsc --noEmit -p packages/electron/tsconfig.json`
Expected: no errors.

Run: `npx vitest run` (repo root, runs the `app` workspace's Vitest project)
Expected: all existing tests pass — this task changed no runtime behavior, only lint-driven syntax and one dead-parameter removal.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json eslint.config.mjs \
  packages/app/src/app/app.const.ts \
  packages/app/src/app/modals/rename-torrent/rename-torrent.ts \
  packages/app/src/app/modals/qb-settings/seeding-ratios/seeding-ratios.ts \
  packages/app/src/app/modals/qb-settings/storage/storage.ts \
  packages/app/src/app/pages/main/grid/grid.ts \
  packages/app/src/app/services/menu-bar-command-handler.service.ts \
  packages/app/src/app/modals/torrent-details/peers/flag-cell-renderer/flag-cell-renderer.ts \
  packages/app/src/app/pipes/humanize-duration-pipe.ts \
  packages/app/src/app/services/context-menu.service.spec.ts \
  packages/app/src/app/services/server-store.service.spec.ts \
  packages/app/src/app/services/toast.service.spec.ts \
  packages/app/src/app/modals/qb-settings/qb-settings.interface.ts \
  packages/app/src/app/modals/settings/settings.interface.ts \
  packages/app/src/app/modals/torrent-details/torrent-details.interface.ts \
  packages/app/src/app/pages/main/grid/grid-keyboard-nav.service.ts \
  packages/electron/src/ipc/qbittorrent.ts \
  packages/electron/src/ipc/server.ts \
  packages/electron/src/main-window.ts \
  packages/electron/src/main.ts
git commit -m "#287: enable eslint and typescript-eslint recommended rule sets"
```

---

### Tasks 2-10: fix `@typescript-eslint/no-explicit-any` in real source

Each task below owns a disjoint cluster of files. For every occurrence:

1. Read enough surrounding code (the function/class, and how its result or parameter is consumed) to know the real shape.
2. Check whether `@bitbutler/shared` (`packages/shared/src/models/`), `ag-grid-community`, or an already-imported type in the same file/directory already expresses that shape — reuse it. Look at sibling files in the same directory first (e.g. other cell renderers/filters already type `ICellRendererParams<RowType, ValueType>` correctly).
3. If nothing fits, add the narrowest local `interface`/`type` next to its usage (or in the nearest `*.model.ts`/`*.interface.ts` if it's shared across the file).
4. Never replace `any` with a wider escape hatch (`unknown` cast chains, `as unknown as T` where a direct type would do) unless the value genuinely comes from an untyped boundary (e.g. raw `JSON.parse` of an external API response) — in that case `unknown` plus a narrowing check/guard is correct, a bare re-cast is not.

**Task verification (same for every task in this range):**

- Run: `npx eslint <every file this task lists> --rule '{"@typescript-eslint/no-explicit-any": "error"}'` — expect `0 problems`. (Scoping the rule like this ignores unrelated pre-existing issues in the same run and keeps the check fast; the plain `npx eslint <files>` should also show zero errors since Task 1 already cleared every other rule.)
- Run: `npx tsc --noEmit -p packages/app/tsconfig.app.json` — expect no errors.
- Run: `npx vitest run <the file's matching .spec.ts, if one exists>` — expect pass. If a type change legitimately requires updating a spec's mock shape (e.g. a mock object literal now needs an extra property to satisfy a real interface instead of `any`), update the spec's mock, not the production type.
- Commit only that task's files.

---

### Task 2: `torrent-command-handler.service.ts` (16 occurrences)

**Files:**

- Modify: `packages/app/src/app/services/torrent-command-handler.service.ts` — `any` at lines 91, 114, 135, 163, 187, 217, 240, 268, 299, 320, 341, 364, 381, 403, 425, 447.

- [ ] **Step 1:** Read the whole file. This service handles the `TORRENT_*` command-bus commands (see `CommandBusService`/`commandBusService.emit` pattern in `CLAUDE.md`); each handler likely destructures a command payload and calls into `QbService`. Check `packages/shared/src/models/` and `packages/app/src/app/models/` for existing command payload / qBittorrent request types.
- [ ] **Step 2:** Replace each `any` with the real payload/parameter type or a precise return type, per the shared investigation rules above.
- [ ] **Step 3:** Run the Task verification block above (spec file: `torrent-command-handler.service.spec.ts` if present in the same directory).
- [ ] **Step 4:** Commit: `git add packages/app/src/app/services/torrent-command-handler.service.ts && git commit -m "#287: type torrent-command-handler.service.ts"` (add its spec file too if it needed a mock update).

---

### Task 3: torrent-details actions/data services + `torrent-details.ts` + `peers.ts` (28 occurrences)

**Files:**

- Modify: `packages/app/src/app/modals/torrent-details/torrent-details-actions.service.ts` — lines 80, 113, 131, 149, 171, 206, 228, 244, 262, 280, 298, 316, 354.
- Modify: `packages/app/src/app/modals/torrent-details/torrent-details-data.service.ts` — lines 52, 163, 200, 218, 236, 248, 258, 272, 323, 324, 337, 367.
- Modify: `packages/app/src/app/modals/torrent-details/torrent-details.ts` — line 81.
- Modify: `packages/app/src/app/modals/torrent-details/peers/peers.ts` — lines 55, 173.

- [ ] **Step 1:** Read all four files together — they form one feature (the torrent-details modal and its peers tab). `torrent-details-data.service.ts` likely fetches/shapes qBittorrent API data; `torrent-details-actions.service.ts` likely issues qBittorrent commands. Check `@bitbutler/shared` for existing qBittorrent response/request models before inventing new ones.
- [ ] **Step 2:** Replace each `any` with a real type, reusing one type across all four files where the same shape recurs (e.g. if `torrent-details-data.service.ts` already types a peer object, `peers.ts` should import and reuse it, not redefine it).
- [ ] **Step 3:** Run the Task verification block (spec files: any `*.spec.ts` alongside these four files).
- [ ] **Step 4:** Commit all four files together (they're one feature) with `git commit -m "#287: type torrent-details services and peers tab"`.

---

### Task 4: grid core (22 occurrences)

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/grid.lib.ts` — lines 49, 433, 1092, 1113, 1115, 1121, 1231, 1287, 1288, 1298.
- Modify: `packages/app/src/app/pages/main/grid/grid.ts` — lines 313, 321, 343.
- Modify: `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts` — lines 564 (×2), 571.
- Modify: `packages/app/src/app/pages/main/grid/context-menu/context-menu.ts` — lines 36, 168.
- Modify: `packages/app/src/app/pages/main/grid/context-menu/cell-value-formatter.util.ts` — line 9 (×2).
- Modify: `packages/app/src/app/pages/main/grid/grid-keyboard-nav.service.ts` — line 190.
- Modify: `packages/app/src/app/pages/main/grid/grid-inline-edit.service.ts` — line 56.

- [ ] **Step 1:** Read all seven files. This is the AG Grid integration layer — most `any` usages are likely AG Grid callback params (`ValueFormatterParams`, `ICellRendererParams`, `CellClassParams`, `GetContextMenuItemsParams`, etc.) or grid row/column typing. `grid.lib.ts` at 1092/1113/1115/1121/1231/1287/1288/1298 is a dense cluster — read that whole region in one pass.
- [ ] **Step 2:** Replace each `any` with the matching `ag-grid-community` generic parameter (check how other, already-`any`-free files in `packages/app/src/app/pages/main/grid/renderers/` or `column-filters/` type the same callbacks, if any exist post-Task-5/7 — otherwise use the AG Grid type docs' shape directly) or a real domain type from `packages/app/src/app/models/`.
- [ ] **Step 3:** Run the Task verification block (spec files: `grid.spec.ts`, `grid.lib.spec.ts`, etc. if present).
- [ ] **Step 4:** Commit all seven files together with `git commit -m "#287: type grid core (grid.lib, grid, context-menu, keyboard-nav, inline-edit)"`.

---

### Task 5: grid renderers & overlays (15 occurrences)

**Files:**

- Modify: `packages/app/src/app/modals/torrent-details/peers/flag-cell-renderer/flag-cell-renderer.ts` — lines 15 (×2), 17 (×2), 21 (×3). Note: line 21's `params` was already renamed to `_params` in Task 1 Step 10 for the unused-vars fix — keep that rename, just fix its type.
- Modify: `packages/app/src/app/pages/main/grid/renderers/code-cell-renderer/code-cell-renderer.ts` — lines 15 (×3), 18 (×3).
- Modify: `packages/app/src/app/pages/main/grid/overlays/no-row-overlay/no-row-overlay.ts` — line 7.
- Modify: `packages/app/src/app/pages/main/grid/overlays/loading-overlay/loading-overlay.ts` — line 7.

- [ ] **Step 1:** Read all four files. These are all AG Grid `ICellRendererAngularComp` / overlay components — the `<any, any, any>` triples on `ICellRendererParams<TData, TValue, TContext>` should become the real row type (likely a torrent or peer model from `packages/app/src/app/models/` or `@bitbutler/shared`) and real value type (e.g. `string`, `number`, or a specific field's type), not left as `any`.
- [ ] **Step 2:** Replace each `any` accordingly.
- [ ] **Step 3:** Run the Task verification block.
- [ ] **Step 4:** Commit with `git commit -m "#287: type grid renderers and overlays"`.

---

### Task 6: core state services (23 occurrences)

**Files:**

- Modify: `packages/app/src/app/pages/main/server-state/server-state.ts` — lines 64, 65, 66, 67, 68, 69, 70, 71, 201.
- Modify: `packages/app/src/app/services/qb.service.ts` — lines 790, 905, 912, 949, 966 (×2).
- Modify: `packages/app/src/app/services/qb-polling.service.ts` — line 136.
- Modify: `packages/app/src/app/services/torrent-store.service.ts` — line 100.
- Modify: `packages/app/src/app/services/electron.service.ts` — lines 37, 43.
- Modify: `packages/app/src/app/services/ui-command-handler.service.ts` — lines 351, 587.
- Modify: `packages/app/src/app/services/filter.service.ts` — line 183.
- Modify: `packages/app/src/app/services/torrent-export.service.ts` — line 32.

- [ ] **Step 1:** Read all eight files. Per `CLAUDE.md`, `QbPollingService` drives the maindata sync loop and `TorrentStoreService` applies `full_update`/incremental diffs — the 8 consecutive `any`s in `server-state.ts` (lines 64-71) are likely one destructured maindata shape; check `@bitbutler/shared` for an existing qBittorrent maindata/sync-response model before adding a new one.
- [ ] **Step 2:** Replace each `any` accordingly, reusing one shared maindata type across `server-state.ts`, `qb-polling.service.ts`, and `torrent-store.service.ts` if they all touch the same sync payload.
- [ ] **Step 3:** Run the Task verification block.
- [ ] **Step 4:** Commit with `git commit -m "#287: type core state services (server-state, qb, qb-polling, torrent-store, electron, ui-command-handler, filter, torrent-export)"`.

---

### Task 7: filter & select components (12 occurrences)

**Files:**

- Modify: `packages/app/src/app/components/column-filters/datepicker-range-filter/datepicker-range-filter.ts` — lines 97, 100, 111, 114, 123, 130, 133.
- Modify: `packages/app/src/app/components/category-select/category-select.ts` — lines 88, 92, 96.
- Modify: `packages/app/src/app/components/tag-select/tag-select.ts` — lines 72, 76.

- [ ] **Step 1:** Read all three files. `datepicker-range-filter.ts` implements an AG Grid custom filter (`getModel(): any` / `setModel(model: any)` per the earlier investigation) — the model shape is `{ from: Date | null, to: Date | null }`, matching `this.appliedFrom`/`this.appliedTo`. Define that as a local interface (e.g. `interface DateRangeFilterModel { from: number | null; to: number | null }` — check the actual type of `appliedFrom`/`appliedTo` in the class fields first) and use it for both `getModel`'s return type and `setModel`'s parameter.
- [ ] **Step 2:** Fix `category-select.ts` and `tag-select.ts` similarly — check whether they already import a `Category`/`Tag` model from `@bitbutler/shared` or `packages/app/src/app/models/` that the `any` should be instead.
- [ ] **Step 3:** Run the Task verification block.
- [ ] **Step 4:** Commit with `git commit -m "#287: type datepicker-range-filter, category-select, tag-select"`.

---

### Task 8: torrent action modals (18 occurrences)

**Files:**

- Modify: `packages/app/src/app/modals/add-torrent/add-torrent.ts` — lines 255, 266, 604.
- Modify: `packages/app/src/app/modals/manage-categories/manage-categories.ts` — lines 142, 176, 213.
- Modify: `packages/app/src/app/modals/manage-tags/manage-tags.ts` — lines 121, 161.
- Modify: `packages/app/src/app/modals/set-torrent-tags/set-torrent-tags.ts` — lines 79, 119.
- Modify: `packages/app/src/app/modals/set-torrent-category/set-torrent-category.ts` — line 77.
- Modify: `packages/app/src/app/modals/set-path/set-path.ts` — lines 96, 116.
- Modify: `packages/app/src/app/modals/rename-torrent/rename-torrent.ts` — line 67.
- Modify: `packages/app/src/app/modals/torrent-exists/torrent-exists.ts` — line 134.
- Modify: `packages/app/src/app/modals/transfer-limit/transfer-limit.ts` — line 129.
- Modify: `packages/app/src/app/modals/share-limit/share-limit.ts` — line 153.
- Modify: `packages/app/src/app/modals/server-editor/server-editor.ts` — line 203.

- [ ] **Step 1:** These are 11 independent modal components sharing a common shape (likely each has one `catch (err: any)`-style error-handling `any`, or a modal-close/dismiss payload `any`). Read each site individually — don't assume they're all the same pattern without checking.
- [ ] **Step 2:** For error-handling sites, prefer `catch (err: unknown)` plus `err instanceof Error ? err.message : String(err)` (or whatever the existing error-toast pattern in the file already does elsewhere) over `any`. For payload sites, use the real modal-result/input type from `@bitbutler/shared`'s `TorrentDraftModel` or the file's own local interfaces.
- [ ] **Step 3:** Run the Task verification block.
- [ ] **Step 4:** Commit with `git commit -m "#287: type torrent action modals"`.

---

### Task 9: settings & misc (15 occurrences)

**Files:**

- Modify: `packages/app/src/app/modals/settings/settings.ts` — line 117.
- Modify: `packages/app/src/app/modals/qb-settings/qb-settings.ts` — line 131.
- Modify: `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.ts` — lines 317, 331.
- Modify: `packages/app/src/app/services/torrent-list-grid.settings.service.ts` — lines 42, 55, 67.
- Modify: `packages/app/src/app/pages/main/main.ts` — lines 81, 82, 117, 118, 119.
- Modify: `packages/app/src/app/components/toast-overlay/toast-overlay.ts` — line 28.
- Modify: `packages/app/src/app/app.config.ts` — line 26.
- Modify: `packages/app/src/app/utils/modal-input.ts` — line 5.

- [ ] **Step 1:** Read all eight files. `torrent-list-grid.settings.service.ts` and `torrent-list-grid.ts` (the settings-modal tab) likely share a grid-settings shape — check `packages/app/src/app/models/torrent-list-grid.model.ts` (fixed in Task 10, so read it as of the start of this task — if Task 10 hasn't run yet, its `any`s are still there; just don't introduce new ones on top) for the type these two files should both be using.
- [ ] **Step 2:** Fix each site with the shared investigation rules above.
- [ ] **Step 3:** Run the Task verification block.
- [ ] **Step 4:** Commit with `git commit -m "#287: type settings modals, main.ts, and misc utilities"`.

---

### Task 10: models & test-setup (8 occurrences)

**Files:**

- Modify: `packages/app/src/app/models/http.model.ts` — lines 8, 13.
- Modify: `packages/app/src/app/models/database.model.ts` — lines 6, 7.
- Modify: `packages/app/src/app/models/torrent-list-grid.model.ts` — line 7.
- Modify: `packages/app/src/app/models/qbittorrent.model.ts` — line 20.
- Modify: `packages/app/src/test-setup.ts` — line 66.

- [ ] **Step 1:** Read `http.model.ts`, `database.model.ts`, `torrent-list-grid.model.ts`, `qbittorrent.model.ts`. These are the app's own local model definitions (distinct from `@bitbutler/shared`'s models) — fix each `any` field/generic with its real type. Since Tasks 4-9 may reference these models, do this task **before** Tasks 4, 6, and 9 if running tasks out of numeric order — otherwise those tasks will import a still-`any`-typed model and this task's later change could ripple back into them. (If running in numeric order 2→10 as listed, this is naturally last, so double-check at the end whether any earlier task left a `TODO`-shaped gap that a now-fixed model type closes — tighten it if so.)
- [ ] **Step 2:** In `packages/app/src/test-setup.ts` line 66, the file already has `declare global { interface Window { bitbutler: BitButlerAPI } }` from `packages/app/src/bitbutler.d.ts` (confirmed during planning). Try removing the cast entirely:

```ts
window.bitbutler = {
```

instead of:

```ts
(window as any).bitbutler = {
```

Run `npx tsc --noEmit -p packages/app/tsconfig.app.json && npx tsc --noEmit -p packages/app/tsconfig.spec.json` immediately after this one change (`test-setup.ts` is included by both). If TypeScript reports the mock object is missing properties or has mismatched types against `BitButlerAPI`, that's real drift between the mock and the current IPC contract — fix the mock object to genuinely satisfy `BitButlerAPI` (add the missing stub methods/properties), don't re-add a cast to paper over it.

- [ ] **Step 3:** Run the Task verification block (for `test-setup.ts`, "run vitest" here means the full suite, since it's shared setup: `npx vitest run`).
- [ ] **Step 4:** Commit with `git commit -m "#287: type app models and test-setup bitbutler mock"`.

---

## Final Verification (after all 10 tasks)

- [ ] Run `npm run lint` from the repo root — expect exit 0, zero warnings (the repo's `max-warnings=0` policy).
- [ ] Run `npm test` from the repo root — expect all workspaces' tests to pass.
- [ ] Run `npm run build` — expect the Angular production build to succeed (confirms no type errors slipped through the per-task `tsc --noEmit` checks).
- [ ] Diff `git diff main --stat` and skim it once end-to-end for anything that looks like a behavior change rather than a type/lint fix — this plan should produce a pure type-safety and lint-config change set.
- [ ] Remove the `docs/superpowers` folder in its own commit (per `CLAUDE.md`: specs/plans must not be merged to main) before opening the PR: `git rm -r docs/superpowers && git commit -m "#287: removed spec and plan"`.
- [ ] Open the PR per `CLAUDE.md`'s PR conventions (read `.github/pull_request_template.md` first), with `Fixes #287` in the description.
