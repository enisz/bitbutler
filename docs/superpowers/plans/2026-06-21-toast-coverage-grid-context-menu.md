# Toast Coverage - Grid Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the toast-feedback gaps in `TorrentCommandHandlerService` (which backs the grid context menu's start/stop/force-resume/recheck/reannounce/super-seeding/auto-tmm/queue actions) and add the missing clipboard-copy confirmations in `GridContextMenuService`, per the "Context menu and shared modal toast coverage" section of `docs/superpowers/specs/2026-06-21-toast-consistency-design.md`.

**Architecture:** `TorrentCommandHandlerService` already has a `getContext()` guard helper and a `try/catch` shape for some methods (`handlePause`, `handleResume`, `handlePauseAll`, `handleResumeAll`, the four `handleQueueMove*`); this plan adds toast calls to those existing try/catch blocks. Five methods (`handleForceResume`, `handleReannounce`, `handleRecheck`, `handleSuperSeeding`, `handleAutoTmm`) currently have no `try/catch` and aren't even `async` - bare fire-and-forget calls - so this plan converts them to `async`, adds `try/catch` and the `getContext()` guard, and updates their `start()` switch cases to `void`-prefix the now-async call (required to satisfy the project's zero-warnings lint policy on floating promises). `GridContextMenuService`'s five clipboard actions get an `info` toast appended after each existing `this.clipboard.copy(...)` call - no new control flow, since clipboard writes don't fail in a way the app can detect.

**Tech Stack:** Angular 20 (`@ngx-translate/core`), `us.json` flat-nested JSON i18n resource, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Scope is exactly the spec's `TorrentCommandHandlerService` subsection and "Grid context-menu clipboard actions" subsection. The spec's "Shared modals" subsection (SetTorrentTags, SetTorrentCategory, ShareLimit, TransferLimit) is a separate plan - do not touch those four files.
- `handleDelete` is already correct (has a try/catch, a danger toast with a specific title fixed for casing in a separate plan, no success toast since the torrent disappearing from the grid is the confirmation) - no changes in this plan.
- "Raw caught error" message = `error?.message ?? String(error)` (or `e?.message ?? String(e)` matching each method's existing catch-parameter name), passed directly as the message argument, no i18n key - matching the pattern already used in `general.ts`/`qb.service.ts`/the structural-fixes plan.
- A bulk action's in-progress message uses the `{{count}} torrent(s)` style already established in `manage-tags.ts` (this plan uses unspaced `{{count}}` interpolation, matching the majority convention already used in `server-command-handler`/`ui-command-handler`'s i18n keys rather than `manage-tags`'s spaced `{{ count }}` variant - both render identically, this just picks one consistently for every new key in this plan).
- Severity stays exactly as today for every method touched: `.info()` for start-of-action messages where the spec calls for one, `.danger()` for every failure. No method in this plan's scope gets a default-title toast - every new call passes an explicit, specific title.
- The spec gives exact text for `handlePauseAll`/`handleResumeAll`'s info messages ("Pausing all torrents…" / "Resuming all torrents…") and one exact failure-title example (`handleQueueMoveTop`'s "Failed to Move Torrent(s) to Top of Queue"). Every other title/message string in this plan is invented to match those examples' tone and the app's established "Failed to \<verb\> \<noun\>" / Title-Case-no-punctuation convention - each invented string is called out where it's introduced, not just listed in Self-Review.
- New i18n keys for `TorrentCommandHandlerService` live under `services.torrent-command-handler.toast.*`, using the `-title` (here `-failed-title`) suffix convention already established by that namespace's existing `error.delete-failed-title` key. New clipboard-toast keys for `GridContextMenuService` live under `pages.main.grid.context-menu.toast.*` (sibling to the existing `export-failed-title`/`export-failed-count`) and a new `pages.main.grid.context-menu.field.*` block for the bare noun values.
- Both touched spec files' `ToastService` test mocks currently provide only `{ danger: vi.fn() }` - every method in this plan's scope that gains an `info()` call will throw `TypeError: toastService.info is not a function` against the _existing_ unmodified mock, breaking already-passing tests. Each task that introduces the first `.info()` or `.danger()` call in a given spec file adds the missing mock function as its first step, before any assertions.
- Run `npm test --workspace=packages/app` after each task. Pre-commit hooks (Husky + lint-staged) auto-format and lint on commit - `max-warnings=0` is enforced, so every `async` conversion that's called without `await`ing its result in `start()`'s switch statement must be `void`-prefixed.
- Commit format: `#178: <short description>` (continuing the `178-revise-toast-hardcoded-english-messages` branch).

---

### Task 1: `handlePause`/`handleResume` - add info/danger toasts to the existing try/catch

**Files:**

- Modify: `packages/app/src/app/services/torrent-command-handler.service.ts:151-171` (`handlePause`, `handleResume`)
- Modify: `public/i18n/us.json:1601-1605` (`services.torrent-command-handler`)
- Modify: `packages/app/src/app/services/torrent-command-handler.service.spec.ts:40-93` (add `toastInfo` to the `ToastService` mock), `:138-148` (extend the two existing pause/resume tests)

**Interfaces:**

- Consumes: the existing `getContext(): { serverId: string; hashes: string[] } | null` private helper (unchanged).
- Produces: nothing new for other tasks - each task in this plan is independent.

- [ ] **Step 1: Add `toastInfo` to the `ToastService` mock and extend the existing pause/resume tests (failing)**

In `torrent-command-handler.service.spec.ts`, add a `toastInfo` variable next to the existing `toastDanger` (line 40) and wire it into the mock (line 86):

```ts
let toastDanger: ReturnType<typeof vi.fn>;
let toastInfo: ReturnType<typeof vi.fn>;
```

```ts
toastDanger = vi.fn();
toastInfo = vi.fn();
```

```ts
        { provide: ToastService, useValue: { danger: toastDanger, info: toastInfo } },
```

Replace the existing `'should call pauseTorrents on TORRENT_PAUSE'` and `'should call resumeTorrents on TORRENT_RESUME'` tests (lines 138-148) with versions that also assert the new toasts, and add two failure-path tests:

```ts
it('should call pauseTorrents and show an info toast on TORRENT_PAUSE', async () => {
  commands$.next({ type: 'TORRENT_PAUSE' });
  await flushPromises();
  expect(qbService.torrents.pause).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
  expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.pausing');
});

it('should show a danger toast with the raw error when pause fails', async () => {
  qbService.torrents.pause.mockRejectedValueOnce(new Error('pause boom'));
  commands$.next({ type: 'TORRENT_PAUSE' });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'pause boom',
    'services.torrent-command-handler.toast.pause-failed-title',
  );
});

it('should call resumeTorrents and show an info toast on TORRENT_RESUME', async () => {
  commands$.next({ type: 'TORRENT_RESUME' });
  await flushPromises();
  expect(qbService.torrents.resume).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
  expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.resuming');
});

it('should show a danger toast with the raw error when resume fails', async () => {
  qbService.torrents.resume.mockRejectedValueOnce(new Error('resume boom'));
  commands$.next({ type: 'TORRENT_RESUME' });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'resume boom',
    'services.torrent-command-handler.toast.resume-failed-title',
  );
});
```

Note: `translateService.instant` is mocked as `vi.fn((key) => key)` (line 48, unchanged), so these assertions check the raw key string, matching every other test in this file.

- [ ] **Step 2: Run the new tests to confirm they fail**

Run: `npx vitest run torrent-command-handler.service.spec.ts --workspace=packages/app`
Expected: FAIL - `toastInfo`/`toastDanger` not called (production code doesn't call them yet for these two methods).

- [ ] **Step 3: Add the i18n keys**

```json
    "torrent-command-handler": {
      "error": {
        "delete-failed-title": "Failed to delete torrent(s)"
      },
      "toast": {
        "pausing": "Pausing {{count}} torrent(s)…",
        "pause-failed-title": "Failed to Pause Torrent(s)",
        "resuming": "Resuming {{count}} torrent(s)…",
        "resume-failed-title": "Failed to Resume Torrent(s)"
      }
    },
```

(`error.delete-failed-title` is untouched/shown for context; its own casing fix is a separate plan. The `pausing`/`resuming` messages use `{{count}}` for parity with the structural-fixes plan's `{{count}} torrent(s)` convention, even though today's tests don't exercise the interpolated value directly since `translateService.instant` is mocked to return the bare key.)

- [ ] **Step 4: Implement the toasts in `handlePause`/`handleResume`**

```ts
  private async handlePause(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.pausing', {
        count: ctx.hashes.length,
      }),
    );

    try {
      await this.qbService.torrents.pause(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handlePause', 'Pause failed!', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant('services.torrent-command-handler.toast.pause-failed-title'),
      );
    }
  }

  private async handleResume(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.resuming', {
        count: ctx.hashes.length,
      }),
    );

    try {
      await this.qbService.torrents.resume(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handleResume', 'Resume failed!', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant('services.torrent-command-handler.toast.resume-failed-title'),
      );
    }
  }
```

(was `catch (e) { console.error(...); }` with no toast in either method - the `console.error` calls are kept unchanged, only the toast calls and the `e: any` annotation - needed for `e?.message` - are new.)

Note: the test mock asserts `toastInfo` was called with the bare key (not an object with `count`), because `translateService.instant` is mocked as `vi.fn((key) => key)` which ignores its second argument - this matches every other interpolated-message assertion already in this file's sibling spec files (e.g. the structural-fixes plan's tests), so no mock change is needed to support the `{ count }` parameter.

- [ ] **Step 5: Run the tests again to confirm they pass**

Run: `npx vitest run torrent-command-handler.service.spec.ts --workspace=packages/app`
Expected: PASS (all tests in the file, including the four new/modified ones)

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/services/torrent-command-handler.service.ts packages/app/src/app/services/torrent-command-handler.service.spec.ts public/i18n/us.json
git commit -m "#178: add info/danger toasts to handlePause and handleResume"
```

---

### Task 2: `handlePauseAll`/`handleResumeAll` - add info/danger toasts

**Files:**

- Modify: `packages/app/src/app/services/torrent-command-handler.service.ts:173-199` (`handleResumeAll`, `handlePauseAll`)
- Modify: `public/i18n/us.json` (`services.torrent-command-handler.toast`, extending Task 1's block)
- Modify: `packages/app/src/app/services/torrent-command-handler.service.spec.ts:150-160` (extend the two existing tests, add two failure tests)

**Interfaces:**

- Consumes: `toastInfo`/`toastDanger` mock variables added in Task 1 (already present after Task 1 lands).
- Produces: nothing new.

- [ ] **Step 1: Extend the existing pause-all/resume-all tests and add failure tests (failing)**

```ts
it('should call pauseTorrents and show an info toast on TORRENT_PAUSE_ALL', async () => {
  commands$.next({ type: 'TORRENT_PAUSE_ALL' });
  await flushPromises();
  expect(qbService.torrents.pause).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
  expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.pausing-all');
});

it('should show a danger toast with the raw error when pause-all fails', async () => {
  qbService.torrents.pause.mockRejectedValueOnce(new Error('pause all boom'));
  commands$.next({ type: 'TORRENT_PAUSE_ALL' });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'pause all boom',
    'services.torrent-command-handler.toast.pause-all-failed-title',
  );
});

it('should call resumeTorrents and show an info toast on TORRENT_RESUME_ALL', async () => {
  commands$.next({ type: 'TORRENT_RESUME_ALL' });
  await flushPromises();
  expect(qbService.torrents.resume).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
  expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.resuming-all');
});

it('should show a danger toast with the raw error when resume-all fails', async () => {
  qbService.torrents.resume.mockRejectedValueOnce(new Error('resume all boom'));
  commands$.next({ type: 'TORRENT_RESUME_ALL' });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'resume all boom',
    'services.torrent-command-handler.toast.resume-all-failed-title',
  );
});
```

(replaces the existing `'should call pauseTorrents on TORRENT_PAUSE_ALL with all hashes'` / `'...TORRENT_RESUME_ALL...'` tests, lines 150-160)

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run torrent-command-handler.service.spec.ts --workspace=packages/app`
Expected: FAIL on the four new/modified assertions.

- [ ] **Step 3: Add the i18n keys**

```json
        "pausing-all": "Pausing all torrents…",
        "pause-all-failed-title": "Failed to Pause All Torrents",
        "resuming-all": "Resuming all torrents…",
        "resume-all-failed-title": "Failed to Resume All Torrents"
```

(`pausing-all`/`resuming-all` text is verbatim from the spec; the failure titles are invented - "Failed to Pause All Torrents"/"Failed to Resume All Torrents" rather than reusing the singular `pause-failed-title`/`resume-failed-title`, since the "all torrents" scope is meaningfully different information for the user and the spec's own per-file table treats `handlePauseAll`/`handleResumeAll` as separate rows from the singular versions.)

- [ ] **Step 4: Implement**

```ts
  private async handleResumeAll(): Promise<void> {
    const serverId = this.serverStore.currentServerId();
    const hashes = this.torrentStore.torrentsArray().map((t) => t.hash);

    if (!serverId) return;
    if (hashes.length === 0) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.resuming-all'),
    );

    try {
      await this.qbService.torrents.resume(serverId, hashes);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handleResumeAll', 'Resume all failed!', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.resume-all-failed-title',
        ),
      );
    }
  }

  private async handlePauseAll(): Promise<void> {
    const serverId = this.serverStore.currentServerId();
    const hashes = this.torrentStore.torrentsArray().map((t) => t.hash);

    if (!serverId) return;
    if (hashes.length === 0) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.pausing-all'),
    );

    try {
      await this.qbService.torrents.pause(serverId, hashes);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handlePauseAll', 'Pause all failed', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.pause-all-failed-title',
        ),
      );
    }
  }
```

(these two methods keep their own `serverId`/`hashes` guard rather than `getContext()`, since they intentionally read from `torrentStore.torrentsArray()` - all torrents - not `selectionStore.selectedHashes()` - unchanged from today, only the `catch` parameter gains `: any` and the toast calls are new)

- [ ] **Step 5: Run to confirm pass**

Run: `npx vitest run torrent-command-handler.service.spec.ts --workspace=packages/app`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/services/torrent-command-handler.service.ts packages/app/src/app/services/torrent-command-handler.service.spec.ts public/i18n/us.json
git commit -m "#178: add info/danger toasts to handlePauseAll and handleResumeAll"
```

---

### Task 3: `handleForceResume`/`handleReannounce`/`handleRecheck` - convert to async with try/catch, add toasts

**Files:**

- Modify: `packages/app/src/app/services/torrent-command-handler.service.ts:24-75` (`start()`'s switch statement), `:85-91` (`handleForceResume`), `:101-113` (`handleReannounce`, `handleRecheck`)
- Modify: `public/i18n/us.json` (`services.torrent-command-handler.toast`, extending Tasks 1-2's block)
- Modify: `packages/app/src/app/services/torrent-command-handler.service.spec.ts:186-216` (extend the three existing tests, add three failure tests)

**Interfaces:**

- Consumes: `getContext()` (existing helper, newly adopted by these three methods for consistency with `handlePause`/`handleResume`/the four `handleQueueMove*` methods - not explicitly required by the spec, but matches every other per-selection method in this file; see Self-Review).
- Produces: nothing new.

- [ ] **Step 1: Extend the existing tests and add failure tests (failing)**

```ts
it('should call reannounceTorrents and show an info toast on TORRENT_REANNOUNCE', async () => {
  commands$.next({ type: 'TORRENT_REANNOUNCE' });
  await flushPromises();
  expect(qbService.torrents.reannounce).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
  expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.reannouncing');
});

it('should show a danger toast with the raw error when reannounce fails', async () => {
  qbService.torrents.reannounce.mockRejectedValueOnce(new Error('reannounce boom'));
  commands$.next({ type: 'TORRENT_REANNOUNCE' });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'reannounce boom',
    'services.torrent-command-handler.toast.reannounce-failed-title',
  );
});

it('should call recheckTorrents and show an info toast on TORRENT_RECHECK', async () => {
  commands$.next({ type: 'TORRENT_RECHECK' });
  await flushPromises();
  expect(qbService.torrents.recheck).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
  expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.rechecking');
});

it('should show a danger toast with the raw error when recheck fails', async () => {
  qbService.torrents.recheck.mockRejectedValueOnce(new Error('recheck boom'));
  commands$.next({ type: 'TORRENT_RECHECK' });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'recheck boom',
    'services.torrent-command-handler.toast.recheck-failed-title',
  );
});

it('should call setForceStart and show an info toast on TORRENT_FORCE_RESUME', async () => {
  commands$.next({ type: 'TORRENT_FORCE_RESUME' });
  await flushPromises();
  expect(qbService.torrents.setForceStart).toHaveBeenCalledWith(
    'server-1',
    ['hash1', 'hash2'],
    true,
  );
  expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.force-resuming');
});

it('should show a danger toast with the raw error when force resume fails', async () => {
  qbService.torrents.setForceStart.mockRejectedValueOnce(new Error('force resume boom'));
  commands$.next({ type: 'TORRENT_FORCE_RESUME' });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'force resume boom',
    'services.torrent-command-handler.toast.force-resume-failed-title',
  );
});
```

(replaces the existing `'should call reannounceTorrents on TORRENT_REANNOUNCE'`, `'...TORRENT_RECHECK...'`, `'...TORRENT_FORCE_RESUME...'` tests, lines 186-216; note `setForceStart`/`reannounce` are currently mocked as bare `vi.fn()` with no resolved value - `mockRejectedValueOnce` works regardless of the default implementation, and a bare `vi.fn()`'s return value of `undefined` is still safely `await`-able once the production code adds `await`)

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run torrent-command-handler.service.spec.ts --workspace=packages/app`
Expected: FAIL on the six new/modified assertions.

- [ ] **Step 3: Add the i18n keys**

```json
        "force-resuming": "Force resuming {{count}} torrent(s)…",
        "force-resume-failed-title": "Failed to Force Resume Torrent(s)",
        "reannouncing": "Reannouncing to trackers for {{count}} torrent(s)…",
        "reannounce-failed-title": "Failed to Reannounce Torrent(s)",
        "rechecking": "Rechecking {{count}} torrent(s)…",
        "recheck-failed-title": "Failed to Recheck Torrent(s)"
```

(all six values invented to match the established "\<gerund\> {{count}} torrent(s)…" / "Failed to \<verb\> Torrent(s)" shape - the spec names these three methods as needing the same treatment as `handlePause`/`handleResume` but doesn't give their exact wording)

- [ ] **Step 4: Convert and implement `handleForceResume`, `handleReannounce`, `handleRecheck`**

```ts
  private async handleForceResume(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.force-resuming', {
        count: ctx.hashes.length,
      }),
    );

    try {
      await this.qbService.torrents.setForceStart(ctx.serverId, ctx.hashes, true);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handleForceResume', 'Force resume failed!', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.force-resume-failed-title',
        ),
      );
    }
  }
```

```ts
  private async handleReannounce(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.reannouncing', {
        count: ctx.hashes.length,
      }),
    );

    try {
      await this.qbService.torrents.reannounce(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handleReannounce', 'Reannounce failed!', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.reannounce-failed-title',
        ),
      );
    }
  }
```

```ts
  private async handleRecheck(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.rechecking', {
        count: ctx.hashes.length,
      }),
    );

    try {
      await this.qbService.torrents.recheck(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handleRecheck', 'Recheck failed!', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant('services.torrent-command-handler.toast.recheck-failed-title'),
      );
    }
  }
```

(were three bare synchronous methods with no `try`/`catch`/`await`/error handling at all - e.g. `private handleForceResume(): void { this.qbService.torrents.setForceStart(this.serverStore.currentServerId() ?? '', this.selectionStore.selectedHashes(), true); }` - now `async`, guarded by `getContext()`, awaited, and wrapped)

- [ ] **Step 5: Update `start()`'s switch statement to `void`-prefix the now-async calls**

```ts
          case 'TORRENT_REANNOUNCE':
            void this.handleReannounce();
            break;
          case 'TORRENT_RECHECK':
            void this.handleRecheck();
            break;
```

(`TORRENT_RECHECK` already had the `void` prefix; `TORRENT_REANNOUNCE` did not - add it, since `handleReannounce` is now `async` and returns a `Promise` that must not be a floating, unhandled promise per the project's `max-warnings=0` lint policy)

```ts
          case 'TORRENT_FORCE_RESUME':
            void this.handleForceResume();
            break;
```

(was `this.handleForceResume();` with no `void` - add it for the same reason)

- [ ] **Step 6: Run to confirm pass**

Run: `npx vitest run torrent-command-handler.service.spec.ts --workspace=packages/app`
Expected: PASS

- [ ] **Step 7: Run lint to confirm no floating-promise warnings**

Run: `npm run lint --workspace=packages/app`
Expected: PASS, zero warnings

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/services/torrent-command-handler.service.ts packages/app/src/app/services/torrent-command-handler.service.spec.ts public/i18n/us.json
git commit -m "#178: add try/catch and toasts to handleForceResume, handleReannounce, and handleRecheck"
```

---

### Task 4: `handleSuperSeeding`/`handleAutoTmm` - convert to async with try/catch, add danger-only toast

**Files:**

- Modify: `packages/app/src/app/services/torrent-command-handler.service.ts:24-75` (switch statement), `:77-99` (`handleAutoTmm`, `handleSuperSeeding`)
- Modify: `public/i18n/us.json` (`services.torrent-command-handler.toast`, extending Tasks 1-3's block)
- Modify: `packages/app/src/app/services/torrent-command-handler.service.spec.ts:198-226` (extend the two existing tests, add four failure tests - two states x two methods)

**Interfaces:**

- Consumes: `getContext()`.
- Produces: nothing new.

- [ ] **Step 1: Extend the existing tests and add failure tests (failing)**

```ts
it('should call setSuperSeeding with inverted status and no info toast on TORRENT_SUPER_SEEDING', async () => {
  commands$.next({ type: 'TORRENT_SUPER_SEEDING', status: false });
  await flushPromises();
  expect(qbService.torrents.setSuperSeeding).toHaveBeenCalledWith(
    'server-1',
    ['hash1', 'hash2'],
    true,
  );
  expect(toastInfo).not.toHaveBeenCalled();
});

it('should show "failed to enable" when enabling super seeding fails', async () => {
  qbService.torrents.setSuperSeeding.mockRejectedValueOnce(new Error('super seeding boom'));
  commands$.next({ type: 'TORRENT_SUPER_SEEDING', status: false });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'super seeding boom',
    'services.torrent-command-handler.toast.enable-super-seeding-failed-title',
  );
});

it('should show "failed to disable" when disabling super seeding fails', async () => {
  qbService.torrents.setSuperSeeding.mockRejectedValueOnce(new Error('super seeding boom'));
  commands$.next({ type: 'TORRENT_SUPER_SEEDING', status: true });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'super seeding boom',
    'services.torrent-command-handler.toast.disable-super-seeding-failed-title',
  );
});

it('should call setAutoManagement with inverted status and no info toast on TORRENT_AUTO_TMM', async () => {
  commands$.next({ type: 'TORRENT_AUTO_TMM', status: true });
  await flushPromises();
  expect(qbService.torrents.setAutoManagement).toHaveBeenCalledWith(
    'server-1',
    ['hash1', 'hash2'],
    false,
  );
  expect(toastInfo).not.toHaveBeenCalled();
});

it('should show "failed to enable" when enabling auto-tmm fails', async () => {
  qbService.torrents.setAutoManagement.mockRejectedValueOnce(new Error('auto tmm boom'));
  commands$.next({ type: 'TORRENT_AUTO_TMM', status: false });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'auto tmm boom',
    'services.torrent-command-handler.toast.enable-auto-tmm-failed-title',
  );
});

it('should show "failed to disable" when disabling auto-tmm fails', async () => {
  qbService.torrents.setAutoManagement.mockRejectedValueOnce(new Error('auto tmm boom'));
  commands$.next({ type: 'TORRENT_AUTO_TMM', status: true });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'auto tmm boom',
    'services.torrent-command-handler.toast.disable-auto-tmm-failed-title',
  );
});
```

(replaces the existing `'should call setSuperSeeding with inverted status on TORRENT_SUPER_SEEDING'` / `'...TORRENT_AUTO_TMM...'` tests, lines 198-226. The command's `status` parameter is the _current_ state before toggling - `handleSuperSeeding(status)` calls `setSuperSeeding(..., !status)` - so `status: false` means "currently off, about to be enabled" and `status: true` means "currently on, about to be disabled"; the two failure tests for each method cover both resulting states.)

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run torrent-command-handler.service.spec.ts --workspace=packages/app`
Expected: FAIL on the new/modified assertions.

- [ ] **Step 3: Add the i18n keys**

```json
        "enable-super-seeding-failed-title": "Failed to Enable Super Seeding",
        "disable-super-seeding-failed-title": "Failed to Disable Super Seeding",
        "enable-auto-tmm-failed-title": "Failed to Enable Automatic Torrent Management",
        "disable-auto-tmm-failed-title": "Failed to Disable Automatic Torrent Management"
```

(all four invented - the spec says only "wrap in try/catch and add a danger toast with a specific title on failure", without giving exact text. Titles are state-aware, matching the menu's own `enable-super-seeding`/`disable-super-seeding` and `enable-auto-tmm`/`disable-auto-tmm` label keys in `grid-context-menu.service.ts`/`us.json` lines ~297-300, ~333-336. "Automatic Torrent Management" spells out "Auto TMM" for a clearer failure-toast message than the menu label's abbreviation.)

- [ ] **Step 4: Convert and implement `handleSuperSeeding`, `handleAutoTmm`**

```ts
  private async handleAutoTmm(status: boolean): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    const enabling = !status;

    try {
      await this.qbService.torrents.setAutoManagement(ctx.serverId, ctx.hashes, enabling);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handleAutoTmm', 'Auto TMM toggle failed!', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          enabling
            ? 'services.torrent-command-handler.toast.enable-auto-tmm-failed-title'
            : 'services.torrent-command-handler.toast.disable-auto-tmm-failed-title',
        ),
      );
    }
  }
```

```ts
  private async handleSuperSeeding(status: boolean): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    const enabling = !status;

    try {
      await this.qbService.torrents.setSuperSeeding(ctx.serverId, ctx.hashes, enabling);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleSuperSeeding',
        'Super seeding toggle failed!',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          enabling
            ? 'services.torrent-command-handler.toast.enable-super-seeding-failed-title'
            : 'services.torrent-command-handler.toast.disable-super-seeding-failed-title',
        ),
      );
    }
  }
```

(were two bare synchronous methods with no `try`/`catch`/`await` - e.g. `private handleSuperSeeding(status: boolean): void { this.qbService.torrents.setSuperSeeding(this.serverStore.currentServerId() ?? '', this.selectionStore.selectedHashes(), !status); }` - the `!status` negation is preserved exactly, just extracted into the named `enabling` constant so both the API call and the title selection read the same value)

- [ ] **Step 5: Update `start()`'s switch statement**

```ts
          case 'TORRENT_SUPER_SEEDING':
            void this.handleSuperSeeding(cmd.status);
            break;
          case 'TORRENT_FORCE_RESUME':
            void this.handleForceResume();
            break;
          case 'TORRENT_AUTO_TMM':
            void this.handleAutoTmm(cmd.status);
            break;
```

(adds `void` to `TORRENT_SUPER_SEEDING` and `TORRENT_AUTO_TMM`, which didn't have it before since both methods were synchronous; `TORRENT_FORCE_RESUME` is shown for context only, already `void`-prefixed by Task 3)

- [ ] **Step 6: Run to confirm pass**

Run: `npx vitest run torrent-command-handler.service.spec.ts --workspace=packages/app`
Expected: PASS

- [ ] **Step 7: Run lint**

Run: `npm run lint --workspace=packages/app`
Expected: PASS, zero warnings

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/services/torrent-command-handler.service.ts packages/app/src/app/services/torrent-command-handler.service.spec.ts public/i18n/us.json
git commit -m "#178: add try/catch and state-aware danger toasts to handleSuperSeeding and handleAutoTmm"
```

---

### Task 5: `handleQueueMoveTop/Up/Down/Bottom` - add danger-only toast to the existing try/catch

**Files:**

- Modify: `packages/app/src/app/services/torrent-command-handler.service.ts:201-263`
- Modify: `public/i18n/us.json` (`services.torrent-command-handler.toast`, extending Tasks 1-4's block)
- Modify: `packages/app/src/app/services/torrent-command-handler.service.spec.ts:162-184` (extend the four existing tests, add four failure tests)

**Interfaces:**

- Consumes: `getContext()` (already used by all four methods, unchanged).
- Produces: nothing new.

- [ ] **Step 1: Extend the existing tests and add failure tests (failing)**

```ts
it('should call topPrio and show no info toast on QUEUE_MOVE_TOP', async () => {
  commands$.next({ type: 'QUEUE_MOVE_TOP' });
  await flushPromises();
  expect(qbService.torrents.topPrio).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
  expect(toastInfo).not.toHaveBeenCalled();
});

it('should show a danger toast when moving to top of queue fails', async () => {
  qbService.torrents.topPrio.mockRejectedValueOnce(new Error('top boom'));
  commands$.next({ type: 'QUEUE_MOVE_TOP' });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'top boom',
    'services.torrent-command-handler.toast.move-top-failed-title',
  );
});

it('should show a danger toast when moving up in queue fails', async () => {
  qbService.torrents.increasePrio.mockRejectedValueOnce(new Error('up boom'));
  commands$.next({ type: 'QUEUE_MOVE_UP' });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'up boom',
    'services.torrent-command-handler.toast.move-up-failed-title',
  );
});

it('should show a danger toast when moving down in queue fails', async () => {
  qbService.torrents.decreasePrio.mockRejectedValueOnce(new Error('down boom'));
  commands$.next({ type: 'QUEUE_MOVE_DOWN' });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'down boom',
    'services.torrent-command-handler.toast.move-down-failed-title',
  );
});

it('should show a danger toast when moving to bottom of queue fails', async () => {
  qbService.torrents.bottomPrio.mockRejectedValueOnce(new Error('bottom boom'));
  commands$.next({ type: 'QUEUE_MOVE_BOTTOM' });
  await flushPromises();
  expect(toastDanger).toHaveBeenCalledWith(
    'bottom boom',
    'services.torrent-command-handler.toast.move-bottom-failed-title',
  );
});
```

(the four `'should call topPrio on QUEUE_MOVE_TOP'`-style tests, lines 162-184, are extended in place to also assert `toastInfo` was not called - the existing `qbService.torrents.*` assertions are unchanged)

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run torrent-command-handler.service.spec.ts --workspace=packages/app`
Expected: FAIL on the four new danger-toast assertions (the "no info toast" assertions already pass today, since no method calls `.info()` for these four yet).

- [ ] **Step 3: Add the i18n keys**

```json
        "move-top-failed-title": "Failed to Move Torrent(s) to Top of Queue",
        "move-up-failed-title": "Failed to Move Torrent(s) Up in Queue",
        "move-down-failed-title": "Failed to Move Torrent(s) Down in Queue",
        "move-bottom-failed-title": "Failed to Move Torrent(s) to Bottom of Queue"
```

(`move-top-failed-title` is the spec's exact verbatim example; the other three are invented to match its preposition pattern - "to Top of Queue" / "to Bottom of Queue" use "to", "Up in Queue" / "Down in Queue" use "in", matching how a person would phrase each direction naturally)

- [ ] **Step 4: Add the danger toasts to the four existing catch blocks**

```ts
  private async handleQueueMoveTop(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      await this.qbService.torrents.topPrio(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleQueueMoveTop',
        'Failed to move torrent(s) to top of queue',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant('services.torrent-command-handler.toast.move-top-failed-title'),
      );
    }
  }

  private async handleQueueMoveUp(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      await this.qbService.torrents.increasePrio(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleQueueMoveUp',
        'Failed to move torrent(s) up in queue',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant('services.torrent-command-handler.toast.move-up-failed-title'),
      );
    }
  }

  private async handleQueueMoveDown(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      await this.qbService.torrents.decreasePrio(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleQueueMoveDown',
        'Failed to move torrent(s) down in queue',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.move-down-failed-title',
        ),
      );
    }
  }

  private async handleQueueMoveBottom(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      await this.qbService.torrents.bottomPrio(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleQueueMoveBottom',
        'Failed to move torrent(s) to bottom of queue',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.move-bottom-failed-title',
        ),
      );
    }
  }
```

(each method's existing `console.error` call and `getContext()` guard are unchanged; only the `catch` parameter gains `: any` and a `toastService.danger(...)` call is added after the existing `console.error`)

- [ ] **Step 5: Run to confirm pass**

Run: `npx vitest run torrent-command-handler.service.spec.ts --workspace=packages/app`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/services/torrent-command-handler.service.ts packages/app/src/app/services/torrent-command-handler.service.spec.ts public/i18n/us.json
git commit -m "#178: add danger toasts to the four queue-move handlers"
```

---

### Task 6: Grid context-menu clipboard actions - add copy confirmation toasts

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts:350-407` (the 5 `copy` submenu items)
- Modify: `public/i18n/us.json:1082-1085` (`pages.main.grid.context-menu.toast`), new `pages.main.grid.context-menu.field` block
- Modify: `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts:95` (add `info` to the `toastService` mock), extend the 7 existing clipboard-action tests (lines ~429-487, ~702-730)

**Interfaces:**

- Consumes: `this.toastService`/`this.translateService` (both already injected in `GridContextMenuService`, lines 67/69 - no new injection needed).
- Produces: nothing new.

- [ ] **Step 1: Add `info` to the `toastService` mock and extend the existing clipboard tests (failing)**

In `grid-context-menu.service.spec.ts`, update the mock declaration and initialization:

```ts
let toastService: { danger: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
```

```ts
toastService = { danger: vi.fn(), info: vi.fn() };
```

Extend the existing single-action tests to also assert the new toast (showing 2 of the 5; the other 3 - `copyMagnet`, `copyInfoHash`, the multi-selection variants - follow the identical pattern and must be added the same way):

```ts
it('torrent.copyName action copies the torrent name for a single selection', async () => {
  const row = makeRow({ name: 'My Film' });
  const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
  (findItem(entries, 'torrent.copyName')!.action as () => void)();
  expect(clipboard.copy).toHaveBeenCalledWith('My Film');
  expect(toastService.info).toHaveBeenCalledWith(
    'pages.main.grid.context-menu.toast.copied-to-clipboard',
  );
});

it('torrent.copyName action joins names with a newline for multi-selection', async () => {
  const rowA = makeRow({ hash: 'a', name: 'Film A' });
  const rowB = makeRow({ hash: 'b', name: 'Film B' });
  const entries = await service.buildTorrentMenu(makeData({ row: rowA, selected: [rowA, rowB] }));
  (findItem(entries, 'torrent.copyName')!.action as () => void)();
  expect(clipboard.copy).toHaveBeenCalledWith('Film A\nFilm B');
  expect(toastService.info).toHaveBeenCalledWith(
    'pages.main.grid.context-menu.toast.copied-to-clipboard',
  );
});
```

Also extend `'torrent.copySavePath action copies the save path for a single selection'`, `'...joins save paths with a newline for multi-selection'`, `'torrent.copyJson action always copies an array...'`, `'torrent.copyInfoHash action copies the torrent hash'`, `'torrent.copyMagnet action copies the magnet URI'`, and `'torrent.copyJson action copies the selection as formatted JSON'` (lines ~446-487) with the identical `expect(toastService.info).toHaveBeenCalledWith('pages.main.grid.context-menu.toast.copied-to-clipboard')` assertion each.

Since `translateService.instant` is mocked as `vi.fn((key: string) => key)` (line 105, unchanged) and the production code's `field` argument is itself the _result_ of an inner `translateService.instant(...)` call, the outer call's interpolation object becomes `{ field: '<inner key string>' }` - but because the mock ignores its second argument entirely, the outer assertion only needs to check the outer key, not the interpolated object. Add one assertion that checks the field-key selection logic directly:

```ts
it('torrent.copyName action requests the plural field label for multi-selection', async () => {
  const rowA = makeRow({ hash: 'a' });
  const rowB = makeRow({ hash: 'b' });
  const entries = await service.buildTorrentMenu(makeData({ row: rowA, selected: [rowA, rowB] }));
  (findItem(entries, 'torrent.copyName')!.action as () => void)();
  expect(translateService.instant).toHaveBeenCalledWith('pages.main.grid.context-menu.field.names');
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run grid-context-menu.service.spec.ts --workspace=packages/app`
Expected: FAIL - the production code doesn't call `toastService.info` yet.

- [ ] **Step 3: Add the i18n keys**

```json
          "toast": {
            "export-failed-title": "Export failed",
            "export-failed-count": "Failed to export {{failed}} of {{total}} torrent(s).",
            "copied-to-clipboard": "Copied {{field}} to clipboard."
          },
          "field": {
            "name": "Name",
            "names": "Names",
            "magnet-link": "Magnet Link",
            "magnet-links": "Magnet Links",
            "info-hash": "Info Hash",
            "info-hashes": "Info Hashes",
            "save-path": "Save Path",
            "save-paths": "Save Paths",
            "json": "JSON"
          }
```

(`export-failed-title`/`export-failed-count` are existing keys shown for placement context only - their own casing fix belongs to a different plan; `copied-to-clipboard` is new, matching `general.ts`'s exact `"Copied {{field}} to clipboard."` shape per the spec, but kept as this component's own key rather than shared. The new `field` block mirrors the existing `isMulti` singular/plural switching already in this file's labels - `json` has no plural since `copyJson`'s action and label both ignore `isMulti`.)

- [ ] **Step 4: Add the toast call to all 5 clipboard actions**

```ts
          {
            kind: 'item',
            id: 'torrent.copyName',
            label: isMulti
              ? 'pages.main.grid.context-menu.item.copy-names'
              : 'pages.main.grid.context-menu.item.copy-name',
            icon: faFont,
            action: () => {
              this.clipboard.copy(
                isMulti
                  ? data.selected.map((torrent) => torrent.name).join('\n')
                  : String(data.row.name),
              );
              this.toastService.info(
                this.translateService.instant(
                  'pages.main.grid.context-menu.toast.copied-to-clipboard',
                  {
                    field: this.translateService.instant(
                      isMulti
                        ? 'pages.main.grid.context-menu.field.names'
                        : 'pages.main.grid.context-menu.field.name',
                    ),
                  },
                ),
              );
            },
          },
          {
            kind: 'item',
            id: 'torrent.copyMagnet',
            label: isMulti
              ? 'pages.main.grid.context-menu.item.copy-magnet-links'
              : 'pages.main.grid.context-menu.item.copy-magnet-link',
            icon: faMagnet,
            action: () => {
              this.clipboard.copy(
                isMulti
                  ? data.selected.map((torrent) => torrent.magnet_uri).join('\n')
                  : String(data.row.magnet_uri),
              );
              this.toastService.info(
                this.translateService.instant(
                  'pages.main.grid.context-menu.toast.copied-to-clipboard',
                  {
                    field: this.translateService.instant(
                      isMulti
                        ? 'pages.main.grid.context-menu.field.magnet-links'
                        : 'pages.main.grid.context-menu.field.magnet-link',
                    ),
                  },
                ),
              );
            },
          },
          {
            kind: 'item',
            id: 'torrent.copyInfoHash',
            label: isMulti
              ? 'pages.main.grid.context-menu.item.copy-info-hashes'
              : 'pages.main.grid.context-menu.item.copy-info-hash',
            icon: faHashtag,
            action: () => {
              this.clipboard.copy(isMulti ? hashes.join('\n') : String(data.row.hash));
              this.toastService.info(
                this.translateService.instant(
                  'pages.main.grid.context-menu.toast.copied-to-clipboard',
                  {
                    field: this.translateService.instant(
                      isMulti
                        ? 'pages.main.grid.context-menu.field.info-hashes'
                        : 'pages.main.grid.context-menu.field.info-hash',
                    ),
                  },
                ),
              );
            },
          },
          {
            kind: 'item',
            id: 'torrent.copySavePath',
            label: isMulti
              ? 'pages.main.grid.context-menu.item.copy-save-paths'
              : 'pages.main.grid.context-menu.item.copy-save-path',
            icon: faFolderOpen,
            action: () => {
              this.clipboard.copy(
                isMulti
                  ? data.selected.map((torrent) => torrent.save_path).join('\n')
                  : String(data.row.save_path),
              );
              this.toastService.info(
                this.translateService.instant(
                  'pages.main.grid.context-menu.toast.copied-to-clipboard',
                  {
                    field: this.translateService.instant(
                      isMulti
                        ? 'pages.main.grid.context-menu.field.save-paths'
                        : 'pages.main.grid.context-menu.field.save-path',
                    ),
                  },
                ),
              );
            },
          },
          {
            kind: 'item',
            id: 'torrent.copyJson',
            label: 'pages.main.grid.context-menu.item.copy-as-json',
            icon: faCode,
            action: () => {
              this.clipboard.copy(String(JSON.stringify(data.selected, null, 2)));
              this.toastService.info(
                this.translateService.instant(
                  'pages.main.grid.context-menu.toast.copied-to-clipboard',
                  { field: this.translateService.instant('pages.main.grid.context-menu.field.json') },
                ),
              );
            },
          },
```

(every action's existing `this.clipboard.copy(...)` argument is byte-for-byte unchanged - only the arrow function bodies grow a statement and braces, and a `this.toastService.info(...)` call is appended after the copy)

- [ ] **Step 5: Run to confirm pass**

Run: `npx vitest run grid-context-menu.service.spec.ts --workspace=packages/app`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts public/i18n/us.json
git commit -m "#178: add copy-confirmation toasts to the 5 grid context-menu clipboard actions"
```

---

## Self-Review

**1. Spec coverage:** Every bullet of the spec's `TorrentCommandHandlerService` subsection has a task: `handlePause`/`handleResume` (Task 1), `handlePauseAll`/`handleResumeAll` (Task 2), `handleForceResume`/`handleReannounce`/`handleRecheck` (Task 3), `handleSuperSeeding`/`handleAutoTmm` (Task 4), the four `handleQueueMove*` (Task 5), `handleDelete` explicitly left unchanged (Global Constraints). The "Grid context-menu clipboard actions" subsection is Task 6, covering all 5 actions. No gaps.

**2. Discrepancy between the spec and current code:** The spec says only `handleReannounce` and `handleRecheck` "need new try/catch blocks (currently have none)", implying `handleForceResume` already has one like `handlePause`/`handleResume` do. Reading the file (this session) shows `handleForceResume` is in fact also a bare synchronous call with no `try`/`catch`/`await` - identical shape to `handleReannounce`/`handleRecheck`, not to `handlePause`/`handleResume`. Task 3 treats all three identically (the correct fix per the actual code), and this paragraph documents that the spec under-described `handleForceResume`'s starting state.

**3. Other judgment calls (spec didn't dictate, documented here):**

- **`getContext()` adoption for `handleForceResume`/`handleReannounce`/`handleRecheck`/`handleSuperSeeding`/`handleAutoTmm`:** none of these five used the existing `getContext()` guard helper before (they read `serverStore`/`selectionStore` directly with no empty-selection guard) - adopted it for consistency with every other per-selection method in the file, since converting to `async`/`try-catch` anyway made this a natural, low-risk inclusion. Not separately unit-tested per-method for the empty-context case, since `getContext()` itself and its early-return behavior are already covered by existing `handlePause`/`handleQueueMoveTop` tests (`'should not delete/pause when no server/torrents are selected'`-style) - duplicating that guard test for every newly-converted method would be redundant, the guard's correctness is structural reuse, not new logic.
- **Invented title/message text:** every string not given verbatim by the spec is called out inline at the task that introduces it (Tasks 1, 3, 4, 5) rather than only listed here, so a reviewer sees the invented value right next to the code it lands in.
- **`handleSuperSeeding`/`handleAutoTmm` state-aware titles:** verified the `!status` negation already present in both methods (the command's `status` param is the _current_ state; the call always sets the opposite) and reused that exact boolean (renamed to `enabling` for readability) to pick between the "enable failed" and "disable failed" title key, so the title and the actual API call can never desync on which direction failed.
- **`void`-prefixing in `start()`'s switch:** `TORRENT_RECHECK` already had `void` despite `handleRecheck` previously being synchronous (harmless no-op on a non-promise); `TORRENT_REANNOUNCE`, `TORRENT_FORCE_RESUME`, `TORRENT_SUPER_SEEDING`, `TORRENT_AUTO_TMM` did not and now must, since their handlers become `async` in Tasks 3-4 - confirmed via the project's `max-warnings=0` lint policy (CLAUDE.md) that an un-awaited, non-void-prefixed Promise-returning call would fail `npm run lint`.
- **Clipboard `{{field}}` keys:** the spec says to reuse "each action's existing singular/plural label switching (`isMulti`)" but the existing labels are full menu-item text ("Copy name"/"Copy names"), not bare nouns - per `general.ts`'s analogous `toClipboard(fieldKey, value)` pattern (which resolves a _separate_ bare-noun key, not the menu/button label, for its own `{{field}}`), Task 6 introduces a parallel new `field.*` block rather than reusing the `item.copy-*` keys directly.
- **`copyJson`'s field value:** the spec doesn't address this action specifically (it has no `isMulti` label variant today); "JSON" was chosen as a single invariant value, consistent with the action itself already ignoring `isMulti`.
- **Verified `Promise` return types:** `qb.service.ts` confirms `recheck`, `reannounce`, `setForceStart`, `setSuperSeeding`, and `setAutoManagement` are all `async (...): Promise<void>` (lines 393, 404, 423, 434, 445) - converting their call sites to `await` is not a behavior-changing assumption.

**4. Placeholder scan:** No "TBD"/"TODO"/"similar to Task N" patterns. Every step shows literal before/after code or JSON, including all 5 clipboard actions in full (not "repeat for the other 4").

**5. Type consistency:** Every catch parameter that newly needs `.message` access is `(e: any)` (was untyped `(e)` in Tasks 1 and 5, didn't exist before in Tasks 3 and 4), matching the `any`-typed convention already used elsewhere in this file (`handleDelete`'s `catch (error: any)`) and in the structural-fixes plan. `getContext()`'s return type (`{ serverId: string; hashes: string[] } | null`) is unchanged and used identically by every method that adopts it. No new shared interfaces are introduced across tasks - each task's i18n keys and toast calls are self-contained to its own methods.

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-21-toast-coverage-grid-context-menu.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
