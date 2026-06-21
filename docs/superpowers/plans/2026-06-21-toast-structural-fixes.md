# Toast Structural Title/Message Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every toast call site listed in the design spec's "Structural fixes" table - where the title named the calling component or a generic severity word, and the message either restated the outcome or hid the real error behind static text - so title = specific outcome and message = the variable detail, per `docs/superpowers/specs/2026-06-21-toast-consistency-design.md`. Also folds in the `qb.service.ts` severity fix and the three "Minor cleanup" items that touch the same call sites.

**Architecture:** Unlike Plan 1 (pure `us.json` value edits), this plan changes production `.ts` code: several call sites swap which value is the _title_ argument vs the _message_ argument, three call sites gain a new `try/catch` that didn't exist before, and one method (`ToastService.error()`) is deleted outright. New i18n keys follow the spec's `-title` suffix convention. Where a message is purely a quoted name/path with no static text, the convention (confirmed against `rename-torrent.ts`/`set-torrent-location.ts`/`general.ts`) is to pass it directly as a template literal - no i18n key needed.

**Tech Stack:** Angular 20 (`@ngx-translate/core`), `us.json` flat-nested JSON i18n resource, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Scope is exactly the spec's "Structural fixes" table (`manage-tags.ts` through `transfer-limit-command-handler.service.ts`), the `qb.service.ts` `.danger()`→`.warning()` fix, and the three "Minor cleanup" items (`settings.ts` try/catch, `ToastService.error()` removal, `torrent-exists.ts` try/catch) - each minor-cleanup item is folded into the task for the file it touches, not a separate task group.
- Out of scope: `general.ts` and the casing-only table (Plan 1, separate plan/PR), adding toasts where none exist today on the grid context menu or shared modals (Plan 3/4 - "coverage gaps"), the CLAUDE.md convention doc (Plan 5).
- "Raw caught error" = `err?.message ?? String(err)`, passed directly as the message argument, no i18n key - matches the existing pattern in `rename-torrent.ts`, `set-torrent-location.ts`, and `general.ts`.
- A message that is _only_ a quoted discrete value (a name or path, no static text) is passed directly as a template literal, e.g. `` `"${name}"` `` - no i18n key, per the spec's i18n key naming section ("no message key is needed - the call site passes the value directly").
- A plain confirmation sentence (no detail) gets a new i18n key with the full sentence text.
- New title keys use the spec's `-title` suffix convention (e.g. `added-title`, `saved-title`).
- Catch-block parameters that need `.message` access are typed `(err: any)` / `(e: any)`, matching the existing convention in `rename-torrent.ts` and `general.ts` (not `unknown`).
- Three call sites currently have **no** error handling at all (`torrent-exists.ts` `deleteTorrentFile()`, `settings.ts` `onSave()`) or use the wrong method (`qb-settings.ts` `onSave()` catch calls the soon-to-be-removed `.error()`) - these need a real `try/catch` added/fixed, and per TDD get a new failing test written first, not just a regression check.
- Every other call site in scope already has a `try/catch` and a toast - only the title/message _shape_ changes, verified via the spec's Per-file migration table.
- `hu.json` is out of scope (per spec Non-goals) - do not touch it.
- Run `npm test --workspace=packages/app` after each task. Pre-commit hooks (Husky + lint-staged) auto-format `*.json` files with Prettier on commit - do not hand-format `us.json` beyond keeping valid JSON.
- Commit format: `#178: <short description>` (continuing the `178-revise-toast-hardcoded-english-messages` branch convention).

---

### Task 1: `manage-tags.ts` - retitle the 4 toast call sites

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.ts:95-129` (`add()`), `:131-166` (`delete()`)
- Modify: `public/i18n/us.json:693-699` (`components.modals.manage-tags.toast`)
- Test (regression only, no new behavior): `packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts` - confirmed its `ToastService` mock is `{ success: vi.fn(), danger: vi.fn() }` with zero assertions on call arguments anywhere in the file, so no spec edits are needed.

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new - `add()`/`delete()` keep the same public signatures.

- [ ] **Step 1: Edit `us.json:693-699` - retitle the toast keys**

```json
        "toast": {
          "added-one-title": "Tag Added",
          "added-title": "Tags Added",
          "added": "{{ count }} tag(s)",
          "deleted-title": "Tag Deleted",
          "add-failed-title": "Failed to Add Tag(s)",
          "delete-failed-title": "Failed to Delete Tag"
        }
```

(was `added-one`/`deleted` holding the old quoted-name sentences, and `add-failed`/`delete-failed` holding static error text; `added` keeps its key name but drops the trailing "added." since the title now states the outcome)

- [ ] **Step 2: Edit `manage-tags.ts` `add()` (lines 95-129)**

```ts
  public async add(): Promise<void> {
    const raw = (this.nameControl.value ?? '').trim();
    if (!raw) return;
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      this.adding.set(true);
      await this.qbService.torrents.createTags(serverId, names);
      const newNames = names.filter((n) => !this.tags().includes(n));
      this.tags.set([...this.tags(), ...newNames].sort((a, b) => a.localeCompare(b)));
      this.nameControl.reset();
      this.toastService.success(
        newNames.length === 1
          ? `"${newNames[0]}"`
          : this.translateService.instant('components.modals.manage-tags.toast.added', {
              count: newNames.length,
            }),
        newNames.length === 1
          ? this.translateService.instant('components.modals.manage-tags.toast.added-one-title')
          : this.translateService.instant('components.modals.manage-tags.toast.added-title'),
      );
    } catch (err: any) {
      console.error(ManageTags.name, 'add', 'Failed to add tag', err);
      this.toastService.danger(
        err?.message ?? String(err),
        this.translateService.instant('components.modals.manage-tags.toast.add-failed-title'),
      );
    } finally {
      this.adding.set(false);
    }
  }
```

(was: title always `components.modals.manage-tags.title` "Manage Tags"; success message via `added-one`/`added` keys with full sentences; catch message via static `add-failed` text, catch param untyped `err`)

- [ ] **Step 3: Edit `manage-tags.ts` `delete()` (lines 131-166)**

```ts
  public async delete(tag: string): Promise<void> {
    const count = this.torrentStoreService.torrentsArray().filter((t) =>
      (t.tags ?? '')
        .split(',')
        .map((s) => s.trim())
        .includes(tag),
    ).length;

    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-tags.delete-confirm.title',
      {
        text: 'components.modals.manage-tags.delete-confirm.message',
        data: { name: tag, count },
      },
      'general.button.delete',
    );
    if (!confirmed) return;

    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.torrents.deleteTags(serverId, [tag]);
      this.tags.set(this.tags().filter((t) => t !== tag));
      this.toastService.success(
        `"${tag}"`,
        this.translateService.instant('components.modals.manage-tags.toast.deleted-title'),
      );
    } catch (err: any) {
      console.error(ManageTags.name, 'delete', 'Failed to delete tag', err);
      this.toastService.danger(
        err?.message ?? String(err),
        this.translateService.instant('components.modals.manage-tags.toast.delete-failed-title'),
      );
    }
  }
```

- [ ] **Step 4: Run the regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS (`manage-tags.spec.ts` is green - it asserts behavior, not toast call arguments)

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/manage-tags/manage-tags.ts public/i18n/us.json
git commit -m "#178: retitle manage-tags toasts to state the outcome"
```

---

### Task 2: `manage-categories.ts` - retitle the 6 toast call sites

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.ts:116-145` (`add()`), `:156-181` (`saveEdit()`), `:183-217` (`delete()`)
- Modify: `public/i18n/us.json:873-880` (`components.modals.manage-categories.toast`)
- Test (regression only): `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts` - confirmed same as Task 1, zero assertions on toast call arguments.

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new.

- [ ] **Step 1: Edit `us.json:873-880` - retitle the toast keys**

```json
        "toast": {
          "added-title": "Category Added",
          "updated-title": "Category Updated",
          "deleted-title": "Category Deleted",
          "add-failed-title": "Failed to Add Category",
          "edit-failed-title": "Failed to Update Category",
          "delete-failed-title": "Failed to Delete Category"
        }
```

(every message in this component is purely a quoted category name - all six keys become `-title` keys, no message keys remain)

- [ ] **Step 2: Edit `manage-categories.ts` `add()` (lines 116-145)**

```ts
  public async add(): Promise<void> {
    const name = (this.addForm.get('name')?.value ?? '').trim();
    const savePath = (this.addForm.get('savePath')?.value ?? '').trim();
    if (!name) return;
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      this.adding.set(true);
      await this.qbService.torrents.createCategory(serverId, name, savePath);
      this.categories.set(
        [...this.categories(), { name, savePath, editing: false }].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      this.addForm.reset();
      this.toastService.success(
        `"${name}"`,
        this.translateService.instant('components.modals.manage-categories.toast.added-title'),
      );
    } catch (err: any) {
      console.error(ManageCategories.name, 'add', 'Failed to add category', err);
      this.toastService.danger(
        err?.message ?? String(err),
        this.translateService.instant(
          'components.modals.manage-categories.toast.add-failed-title',
        ),
      );
    } finally {
      this.adding.set(false);
    }
  }
```

- [ ] **Step 3: Edit `manage-categories.ts` `saveEdit()` (lines 156-181)**

```ts
  public async saveEdit(item: CategoryItem): Promise<void> {
    const newPath = (this.editSavePathControl.value ?? '').trim();
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.torrents.editCategory(serverId, item.name, newPath);
      this.categories.set(
        this.categories().map((c) =>
          c.name === item.name ? { ...c, savePath: newPath, editing: false } : c,
        ),
      );
      this.toastService.success(
        `"${item.name}"`,
        this.translateService.instant('components.modals.manage-categories.toast.updated-title'),
      );
    } catch (err: any) {
      console.error(ManageCategories.name, 'saveEdit', 'Failed to edit category', err);
      this.toastService.danger(
        err?.message ?? String(err),
        this.translateService.instant(
          'components.modals.manage-categories.toast.edit-failed-title',
        ),
      );
    }
  }
```

- [ ] **Step 4: Edit `manage-categories.ts` `delete()` (lines 183-217)**

```ts
  public async delete(item: CategoryItem): Promise<void> {
    const count = this.torrentStoreService
      .torrentsArray()
      .filter((t) => t.category === item.name).length;

    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-categories.delete-confirm.title',
      {
        text: 'components.modals.manage-categories.delete-confirm.message',
        data: { name: item.name, count },
      },
      'general.button.delete',
    );
    if (!confirmed) return;

    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.torrents.removeCategories(serverId, [item.name]);
      this.categories.set(this.categories().filter((c) => c.name !== item.name));
      this.toastService.success(
        `"${item.name}"`,
        this.translateService.instant('components.modals.manage-categories.toast.deleted-title'),
      );
    } catch (err: any) {
      console.error(ManageCategories.name, 'delete', 'Failed to delete category', err);
      this.toastService.danger(
        err?.message ?? String(err),
        this.translateService.instant(
          'components.modals.manage-categories.toast.delete-failed-title',
        ),
      );
    }
  }
```

- [ ] **Step 5: Run the regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/modals/manage-categories/manage-categories.ts public/i18n/us.json
git commit -m "#178: retitle manage-categories toasts to state the outcome"
```

---

### Task 3: `torrent-exists.ts` - add missing try/catch and retitle

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-exists/torrent-exists.ts:82-91` (`deleteTorrentFile()`)
- Modify: `public/i18n/us.json:653-655` (`components.modals.torrent-exists.toast`)
- Test: `packages/app/src/app/components/modals/torrent-exists/torrent-exists.spec.ts:26` (widen `mockToastService`), add new test in the `deleteTorrentFile` describe block (lines 106-138)

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new - `deleteTorrentFile()` keeps its `Promise<void>` signature; it just no longer throws on IPC failure.

- [ ] **Step 1: Edit `us.json:653-655` - retitle and repurpose the toast keys**

```json
        "toast": {
          "deleted-title": "Torrent File Deleted",
          "deleted": "The torrent file has been removed from disk.",
          "delete-failed-title": "Failed to Delete Torrent File"
        }
```

(was just `"deleted": "Torrent file has been deleted."` used as the message under the default-component-name title; `deleted` keeps its key name but its text changes to a confirmation sentence)

- [ ] **Step 2: Write the failing test - danger toast on `deleteFile` rejection**

In `torrent-exists.spec.ts`, change line 26 from:

```ts
mockToastService = { success: vi.fn() };
```

to:

```ts
mockToastService = { success: vi.fn(), danger: vi.fn() };
```

Then add this test inside the existing `describe('deleteTorrentFile', ...)` block (after the test at line 131, before the "should not call deleteFile when originalPath is null" test):

```ts
it('should show a danger toast with the raw error and not mark fileDeleted when deleteFile fails', async () => {
  vi.spyOn(window.bitbutler.torrent, 'deleteFile').mockRejectedValue(new Error('disk error'));
  fixture.componentRef.setInput('originalPath', '/tmp/test.torrent');
  fixture.detectChanges();

  await component.deleteTorrentFile();

  expect(component.fileDeleted()).toBe(false);
  expect(mockToastService.danger).toHaveBeenCalledWith(
    'disk error',
    'components.modals.torrent-exists.toast.delete-failed-title',
  );
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test --workspace=packages/app -- torrent-exists`
Expected: FAIL - `deleteTorrentFile()` has no `try/catch` yet, so the rejection propagates as an unhandled promise rejection instead of calling `mockToastService.danger`.

- [ ] **Step 4: Edit `torrent-exists.ts` `deleteTorrentFile()` (lines 82-91)**

```ts
  public async deleteTorrentFile(): Promise<void> {
    const path = this.originalPath();
    if (!path) return;
    try {
      await window.bitbutler.torrent.deleteFile({ path });
      this.fileDeleted.set(true);
      this.toastService.success(
        this.translateService.instant('components.modals.torrent-exists.toast.deleted'),
        this.translateService.instant('components.modals.torrent-exists.toast.deleted-title'),
      );
    } catch (err: any) {
      console.error(TorrentExists.name, 'deleteTorrentFile', 'Failed to delete torrent file', err);
      this.toastService.danger(
        err?.message ?? String(err),
        this.translateService.instant('components.modals.torrent-exists.toast.delete-failed-title'),
      );
    }
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=packages/app -- torrent-exists`
Expected: PASS (including the existing "should disable the delete button and show a success toast" test, which only asserts `success` was called, not its arguments)

- [ ] **Step 6: Run the full regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-exists/torrent-exists.ts packages/app/src/app/components/modals/torrent-exists/torrent-exists.spec.ts public/i18n/us.json
git commit -m "#178: add error handling and retitle torrent-exists delete-file toast"
```

---

### Task 4: `server-command-handler.service.ts` - retitle the 3 actions

**Files:**

- Modify: `packages/app/src/app/services/server-command-handler.service.ts:51-84`
- Modify: `public/i18n/us.json:1583-1591` (`services.server-command-handler`)
- Test: `packages/app/src/app/services/server-command-handler.service.spec.ts:54-97` (4 existing tests assert the old key-based call shape and must be rewritten to match the new behavior)

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new - `handleServerAdded`/`handleServerUpdated`/`handleServerDeleted` keep their signatures.

- [ ] **Step 1: Edit `us.json:1583-1591` - retitle and repurpose the keys**

```json
    "server-command-handler": {
      "success": {
        "added-title": "Server Added",
        "added-fallback": "The server has been added."
      },
      "info": {
        "updated-title": "Server Updated",
        "deleted-title": "Server Deleted"
      }
    },
```

(`added`/`updated`/`deleted` held full "Server "x" added!"-style sentences used as the _message_ under a default title - removed, replaced by direct-pass quoted names; `added-fallback` keeps its key but its text changes from "Server added!" to a confirmation sentence)

- [ ] **Step 2: Edit `server-command-handler.service.ts` (lines 51-84)**

```ts
  private async handleServerAdded(id: string): Promise<void> {
    await this.serverStoreService.refresh();
    const server = this.serverStoreService.servers().find((s) => s.id === id);
    const message = server?.name
      ? `"${server.name}"`
      : this.translateService.instant('services.server-command-handler.success.added-fallback');
    this.toastService.success(
      message,
      this.translateService.instant('services.server-command-handler.success.added-title'),
    );
    if (!this.serverStoreService.currentServerId()) {
      this.serverStoreService.select(id);
    }
  }

  private async handleServerUpdated(id: string): Promise<void> {
    await this.serverStoreService.refresh();
    const server = this.serverStoreService.servers().find((s) => s.id === id);
    this.toastService.info(
      `"${server?.name ?? ''}"`,
      this.translateService.instant('services.server-command-handler.info.updated-title'),
    );
  }

  private async handleServerDeleted(id: string): Promise<void> {
    const server = this.serverStoreService.servers().find((s) => s.id === id);
    await this.serverService.delete(id);
    await this.serverStoreService.refresh();
    this.toastService.info(
      `"${server?.name ?? ''}"`,
      this.translateService.instant('services.server-command-handler.info.deleted-title'),
    );
  }
```

(severity stays `.success()`/`.info()` exactly as before - only the title/message shape changes)

- [ ] **Step 3: Update the 4 affected tests in `server-command-handler.service.spec.ts`**

Replace the test at lines 54-62:

```ts
it('should show success toast after SERVER_ADDED', async () => {
  commands$.next({ type: 'SERVER_ADDED', id: '1' });
  await flushPromises();
  expect(toastSuccess).toHaveBeenCalledWith(
    '"Test Server"',
    'services.server-command-handler.success.added-title',
  );
});
```

Replace the test at lines 71-77:

```ts
it('should fall back to the generic "added" toast when added server is not found', async () => {
  commands$.next({ type: 'SERVER_ADDED', id: 'unknown' });
  await flushPromises();
  expect(toastSuccess).toHaveBeenCalledWith(
    'services.server-command-handler.success.added-fallback',
    'services.server-command-handler.success.added-title',
  );
});
```

Replace the test at lines 79-87:

```ts
it('should show info toast after SERVER_UPDATED', async () => {
  commands$.next({ type: 'SERVER_UPDATED', id: '1' });
  await flushPromises();
  expect(toastInfo).toHaveBeenCalledWith(
    '"Test Server"',
    'services.server-command-handler.info.updated-title',
  );
});
```

Replace the test at lines 89-97:

```ts
it('should show info toast after SERVER_DELETED', async () => {
  commands$.next({ type: 'SERVER_DELETED', id: '1' });
  await flushPromises();
  expect(toastInfo).toHaveBeenCalledWith(
    '"Test Server"',
    'services.server-command-handler.info.deleted-title',
  );
});
```

(the other two tests - "should call select after SERVER_ADDED" and "should not crash the subscription if a command throws" - assert side effects, not toast arguments, and need no change; the `translateService` mock variable stays in the file since `-title` keys still go through `instant()`)

- [ ] **Step 4: Run the suite to verify the updated tests pass**

Run: `npm test --workspace=packages/app -- server-command-handler`
Expected: PASS

- [ ] **Step 5: Run the full regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/services/server-command-handler.service.ts packages/app/src/app/services/server-command-handler.service.spec.ts public/i18n/us.json
git commit -m "#178: retitle server-command-handler toasts to state the outcome"
```

---

### Task 5: `settings.ts` - add missing try/catch and retitle

**Files:**

- Modify: `packages/app/src/app/pages/settings/settings.ts:104-109` (`onSave()`)
- Modify: `public/i18n/us.json:1227-1231` (`pages.settings.success`/`error`)
- Test: `packages/app/src/app/pages/settings/settings.spec.ts:13-20` (widen `toastMock`), `:121-131` (`onSave` describe block)

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new - `onSave()` keeps its `Promise<void>` signature; it just no longer throws on `saveAll()` failure.

- [ ] **Step 1: Edit `us.json:1227-1231` - add title/error keys**

```json
    "settings": {
      "title": "Settings",
      "success": {
        "saved-title": "Settings Saved",
        "saved": "Your changes have been saved."
      },
      "error": {
        "save-failed-title": "Failed to Save Settings",
        "save-failed": "Your changes could not be saved."
      },
```

(`saved` keeps its key but its text changes from "Settings Saved" to a confirmation sentence, since that text now belongs to the new `saved-title` key; the default `.success()` title was the generic "Success" via `general.toast.success`, confirmed at `us.json:1702`, so an explicit title argument is required to show "Settings Saved")

- [ ] **Step 2: Write the failing tests - try/catch around `saveAll()`**

In `settings.spec.ts`, change the type declaration at line 20 from:

```ts
let toastMock: { success: ReturnType<typeof vi.fn> };
```

to:

```ts
let toastMock: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
```

and line 35 from:

```ts
toastMock = { success: vi.fn() };
```

to:

```ts
toastMock = { success: vi.fn(), danger: vi.fn() };
```

Then add these two tests inside the existing `describe('onSave', ...)` block (after the test at lines 127-130):

```ts
it('should show a danger toast with the raw error message when saveAll fails', async () => {
  stateServiceMock.saveAll.mockRejectedValueOnce(new Error('disk full'));
  await component.onSave();
  expect(toastMock.danger).toHaveBeenCalledWith(
    'disk full',
    'pages.settings.error.save-failed-title',
  );
});

it('should not close the modal when saveAll fails', async () => {
  const activeModal = TestBed.inject(NgbActiveModal);
  stateServiceMock.saveAll.mockRejectedValueOnce(new Error('disk full'));
  await component.onSave();
  expect(activeModal.close).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test --workspace=packages/app -- settings.spec`
Expected: FAIL - `onSave()` has no `try/catch` yet, so the rejection propagates instead of calling `toastMock.danger`, and the "not close" test fails because there's nothing stopping `activeModal.close()` (the rejection actually prevents `firstValueFrom`/`success`/`close` from running at all today, so the second test will see `close` not called for the wrong reason - confirm the first test fails with an unhandled rejection before proceeding).

- [ ] **Step 4: Edit `settings.ts` `onSave()` (lines 104-109)**

```ts
  public async onSave(): Promise<void> {
    try {
      await this.stateService.saveAll();
      const message = await firstValueFrom(
        this.translateService.get('pages.settings.success.saved'),
      );
      const title = await firstValueFrom(
        this.translateService.get('pages.settings.success.saved-title'),
      );
      this.toastService.success(message, title);
      this.activeModal.close();
    } catch (err: any) {
      const title = await firstValueFrom(
        this.translateService.get('pages.settings.error.save-failed-title'),
      );
      const message =
        err?.message ??
        (await firstValueFrom(this.translateService.get('pages.settings.error.save-failed')));
      this.toastService.danger(message, title);
    }
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace=packages/app -- settings.spec`
Expected: PASS (including the existing "should show a success toast" test, which only asserts `success` was called, not its arguments)

- [ ] **Step 6: Run the full regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/pages/settings/settings.ts packages/app/src/app/pages/settings/settings.spec.ts public/i18n/us.json
git commit -m "#178: add error handling and retitle settings save toast"
```

---

### Task 6: `qb-settings.ts` - fix the catch path, retitle, and remove `ToastService.error()`

**Files:**

- Modify: `packages/app/src/app/pages/qb-settings/qb-settings.ts:116-128` (`onSave()`)
- Modify: `packages/app/src/app/services/toast.service.ts:215-221` (remove `error()` method)
- Modify: `public/i18n/us.json:1440-1444` (`pages.qb-settings.success`/`error`), `:1617-1620` (`general.error`)
- Test: `packages/app/src/app/pages/qb-settings/qb-settings.spec.ts:23` (widen `toastMock`), `:143-153` (`onSave` describe block)

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new - `onSave()` keeps its signature. `ToastService` loses the public `error()` method; confirmed via `grep -rn "toastService\.error\|\.error(" packages/app/src/app` that `qb-settings.ts:126` is the only caller anywhere in the app (the only other `.error(` hit is `subscriber.error(...)` inside an RxJS `Observable` constructor in `qb.service.ts`, unrelated).

- [ ] **Step 1: Edit `us.json:1440-1444` - add title/error keys**

```json
    "qb-settings": {
      "title": "qBittorrent Settings",
      "success": {
        "saved-title": "qBittorrent Settings Saved",
        "saved": "Your changes have been saved."
      },
      "error": {
        "save-failed-title": "Failed to Save Settings",
        "save-failed": "Your changes could not be saved."
      },
```

(`saved` keeps its key but its text changes from "qBittorrent Settings Saved" to a confirmation sentence, since that text now belongs to the new `saved-title` key)

- [ ] **Step 2: Edit `us.json:1617-1620` - remove the now-orphaned shared key**

```json
  "general": {
    "error": {},
```

(was `"error": { "save-failed": "Failed to save settings." }` - `qb-settings.ts` was its only caller, confirmed by grep; `general.error` becomes an empty object, matching the existing empty-object precedent elsewhere in this file, e.g. `"toast-overlay": {}`)

- [ ] **Step 3: Write the failing tests - real error handling in the catch path**

In `qb-settings.spec.ts`, change the type declaration at line 23 from:

```ts
let toastMock: { success: ReturnType<typeof vi.fn> };
```

to:

```ts
let toastMock: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
```

and line 41 from:

```ts
toastMock = { success: vi.fn() };
```

to:

```ts
toastMock = { success: vi.fn(), danger: vi.fn() };
```

Then add these two tests inside the existing `describe('onSave', ...)` block (after the test at lines 149-152):

```ts
it('should show a danger toast with the raw error message when saveAll fails', async () => {
  stateServiceMock.saveAll.mockRejectedValueOnce(new Error('connection refused'));
  await component.onSave();
  expect(toastMock.danger).toHaveBeenCalledWith(
    'connection refused',
    'pages.qb-settings.error.save-failed-title',
  );
});

it('should not close the modal when saveAll fails', async () => {
  const activeModal = TestBed.inject(NgbActiveModal);
  stateServiceMock.saveAll.mockRejectedValueOnce(new Error('connection refused'));
  await component.onSave();
  expect(activeModal.close).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test --workspace=packages/app -- qb-settings.spec`
Expected: FAIL - the current catch block discards the error entirely (`catch { ... }`) and calls `this.toastService.error(message)`, which doesn't exist on `toastMock`, so the test throws "danger is not a function" / the assertion never matches.

- [ ] **Step 5: Edit `qb-settings.ts` `onSave()` (lines 116-128)**

```ts
  public async onSave(): Promise<void> {
    try {
      await this.stateService.saveAll();
      const message = await firstValueFrom(
        this.translateService.get('pages.qb-settings.success.saved'),
      );
      const title = await firstValueFrom(
        this.translateService.get('pages.qb-settings.success.saved-title'),
      );
      this.toastService.success(message, title);
      this.activeModal.close();
    } catch (err: any) {
      const title = await firstValueFrom(
        this.translateService.get('pages.qb-settings.error.save-failed-title'),
      );
      const message =
        err?.message ??
        (await firstValueFrom(this.translateService.get('pages.qb-settings.error.save-failed')));
      this.toastService.danger(message, title);
    }
  }
```

- [ ] **Step 6: Remove the redundant `ToastService.error()` method**

In `toast.service.ts`, delete lines 215-221:

```ts
  error(html: string, title?: string, duration = 6000): string {
    return this.showHtml(html, {
      type: 'danger',
      title: title ?? this.translateService.instant('general.toast.error'),
      duration,
    });
  }

```

(`danger()` immediately below stays - it was byte-for-byte identical; confirmed `toast.service.spec.ts` has no test referencing `.error(` directly, so no spec edit is needed there)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test --workspace=packages/app -- qb-settings.spec`
Expected: PASS

- [ ] **Step 8: Run the full regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS (confirms no other file references `ToastService.error`)

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/qb-settings.ts packages/app/src/app/pages/qb-settings/qb-settings.spec.ts packages/app/src/app/services/toast.service.ts public/i18n/us.json
git commit -m "#178: fix qb-settings save-failed toast and remove redundant ToastService.error()"
```

---

### Task 7: `update-command-handler.service.ts` - retitle the up-to-date toast

**Files:**

- Modify: `packages/app/src/app/services/update-command-handler.service.ts:46-52`
- Modify: `public/i18n/us.json:1593-1599` (`services.update-command-handler.success`)
- Test: `packages/app/src/app/services/update-command-handler.service.spec.ts:45-49`

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new. The failure branch (`check-failed-title`) is already correct per the spec and is not touched.

- [ ] **Step 1: Edit `us.json:1593-1599` - add the title key**

```json
    "update-command-handler": {
      "error": {
        "check-failed-title": "Update Check Failed"
      },
      "success": {
        "up-to-date-title": "Up to Date",
        "up-to-date": "You're running the latest version."
      }
    },
```

(`up-to-date` keeps its key but its text changes from "You are on the latest version!" to the new sentence, since that text now belongs to the new `up-to-date-title` key)

- [ ] **Step 2: Edit `update-command-handler.service.ts` success branch (lines 46-52)**

```ts
if (response.updateAvailable) {
  this.commandBusService.emit({ type: 'UI_UPDATE_AVAILABLE', update: response });
} else {
  this.toastService.success(
    this.translateService.instant('services.update-command-handler.success.up-to-date'),
    this.translateService.instant('services.update-command-handler.success.up-to-date-title'),
  );
}
```

- [ ] **Step 3: Update the affected test in `update-command-handler.service.spec.ts`**

Replace the test at lines 45-49:

```ts
it('should show success toast when no update available', async () => {
  commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE' });
  await flushPromises();
  expect(toastSuccess).toHaveBeenCalledWith(
    'services.update-command-handler.success.up-to-date',
    'services.update-command-handler.success.up-to-date-title',
  );
});
```

(the danger-toast test for the failure branch at lines 66-74 is untouched - that title was already correct)

- [ ] **Step 4: Run the suite to verify the updated test passes**

Run: `npm test --workspace=packages/app -- update-command-handler`
Expected: PASS

- [ ] **Step 5: Run the full regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/services/update-command-handler.service.ts packages/app/src/app/services/update-command-handler.service.spec.ts public/i18n/us.json
git commit -m "#178: retitle update-command-handler up-to-date toast"
```

---

### Task 8: `content.ts` - retitle the load/save failure toasts

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/content/content.ts:70-79` (`ngOnInit`'s `catchError`), `:109-116` (`onSaved` catch)
- Modify: `public/i18n/us.json:299-305` (`components.modals.torrent-details.content.error`)
- Test (regression only): `packages/app/src/app/components/modals/torrent-details/content/content.spec.ts` - confirmed its `ToastService` mock is `{ danger: vi.fn() }` with no test exercising either catch path or asserting call arguments, so no spec edits are needed.

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new.

- [ ] **Step 1: Edit `us.json:299-305` - retitle the error keys**

```json
        "content": {
          "loading": "Loading Torrent Contents...",
          "error": {
            "failed-to-load-title": "Failed to Load Torrent Contents",
            "failed-to-save-title": "Failed to Save Changes"
          }
        },
```

(`failed-to-load`/`failed-to-save` held static "Failed to ... !" text used as the message under a default title - removed, replaced by direct-pass raw caught error)

- [ ] **Step 2: Edit `content.ts` `ngOnInit`'s `catchError` (lines 70-79)**

```ts
        catchError((e: any) => {
          console.error(Content.name, 'load', 'Failed to load torrent contents', e);
          this.toastService.danger(
            e?.message ?? String(e),
            this.translateService.instant(
              'components.modals.torrent-details.content.error.failed-to-load-title',
            ),
          );
          this.loading.set(false);
          return EMPTY;
        }),
```

- [ ] **Step 3: Edit `content.ts` `onSaved` catch (lines 109-116)**

```ts
    } catch (e: any) {
      console.error(Content.name, 'onSaved', 'Failed to save changes', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'components.modals.torrent-details.content.error.failed-to-save-title',
        ),
      );
    }
```

- [ ] **Step 4: Run the regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/content/content.ts public/i18n/us.json
git commit -m "#178: retitle content tab load/save failure toasts and surface the real error"
```

---

### Task 9: `ui-command-handler.service.ts` - retitle showing-file/opening-folder/connect-failed

**Files:**

- Modify: `packages/app/src/app/services/ui-command-handler.service.ts:268-285` (`UI_OPEN_DESTINATION` showing-file/opening-folder), `:424-435` (`handleServerSwitch` connect-failed)
- Modify: `public/i18n/us.json:1567-1576` (`services.ui-command-handler.info`), `:1555-1566` (`services.menu-bar-command-handler.error`)
- Test (regression only): `packages/app/src/app/services/ui-command-handler.service.spec.ts` - confirmed no test exercises `UI_OPEN_DESTINATION` or `UI_SERVER_SWITCH` (the one `UI_SERVER_EDITOR_OPEN` test only checks that a modal opened, a different code path from `handleServerSwitch`), so no spec edits are needed.

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new.
- Two call sites in this file are deliberately **excluded** from this task - see Self-Review item 2.

- [ ] **Step 1: Edit `us.json:1567-1576` - retitle the info keys**

```json
    "ui-command-handler": {
      "error": {
        "remote-path-missing": "Remote path not provided.",
        "local-path-unresolved": "Could not resolve local path."
      },
      "info": {
        "showing-file-title": "Showing File",
        "opening-folder-title": "Opening Folder"
      }
    },
```

(`showing-file`/`opening-folder` held "Showing/Opening file/folder {{path}}" sentences used as the message under a default "Info" title - removed, replaced by direct-pass quoted path; `error.*` keys are untouched, out of scope - see Self-Review item 3)

- [ ] **Step 2: Edit `us.json:1555-1566` - retitle the connect-failed key**

```json
    "menu-bar-command-handler": {
      "app-loader": {
        "title": "Switching Server",
        "message": "Connecting to {{name}}..."
      },
      "error": {
        "failed-to-connect-title": "Failed to Connect"
      },
      "info": {
        "switching-server": "Switching to {{name}}"
      }
    },
```

(`failed-to-connect` held "Failed to connect to {{name}}!" used as the message under a default "Error" title - removed, replaced by direct-pass quoted name; `info.switching-server` and `app-loader.*` are untouched - transient, exempt per spec)

- [ ] **Step 3: Edit the `UI_OPEN_DESTINATION` showing-file/opening-folder branches (lines 268-285)**

```ts
if (singleFile) {
  this.electronService.showItemInFolder(path);
  this.toastService.info(
    `"${path}"`,
    this.translateService.instant('services.ui-command-handler.info.showing-file-title'),
  );
} else {
  this.electronService.openPath(path);
  this.toastService.info(
    `"${path}"`,
    this.translateService.instant('services.ui-command-handler.info.opening-folder-title'),
  );
}
```

- [ ] **Step 4: Edit `handleServerSwitch`'s connect-failed catch (lines 424-435)**

```ts
    } catch (err) {
      console.error(
        UiCommandHandlerService.name,
        'handleServerSwitch',
        'Failed to switch servers',
        err,
      );
      this.toastService.danger(
        `"${name}"`,
        this.translateService.instant(
          'services.menu-bar-command-handler.error.failed-to-connect-title',
        ),
      );
      this.serverService.setActive(this.serverStoreService.currentServerId());
    }
```

(the `name` variable is already computed at the top of `handleServerSwitch`, line 391 - `const name = server?.name || '';` - reused as-is; the `catch (err)` parameter is unchanged since this branch never reads `err.message`, only logs `err`)

- [ ] **Step 5: Run the regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/services/ui-command-handler.service.ts public/i18n/us.json
git commit -m "#178: retitle ui-command-handler showing-file, opening-folder, and connect-failed toasts"
```

---

### Task 10: `transfer-limit-command-handler.service.ts` - retitle the toggle toast

**Files:**

- Modify: `packages/app/src/app/services/transfer-limit-command-handler.service.ts:52-60`
- Modify: `public/i18n/us.json:1577-1582` (`services.transfer-limit-command-handler.info`)
- Test: `packages/app/src/app/services/transfer-limit-command-handler.service.spec.ts:51-66`

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new. Severity stays `.info()` - this action gets a new terminal title despite staying info-level (it is not in the spec's transient-toast exemption list).

- [ ] **Step 1: Edit `us.json:1577-1582` - add title keys, repurpose message keys**

```json
    "transfer-limit-command-handler": {
      "info": {
        "alternative-limit-on-title": "Alternative Speed Limit On",
        "alternative-limit-on": "Alternative speed limits are now active.",
        "alternative-limit-off-title": "Alternative Speed Limit Off",
        "alternative-limit-off": "Alternative speed limits are no longer active."
      }
    },
```

(`alternative-limit-on`/`-off` keep their key names but their text changes from "Turning ... on/off." to a confirmation sentence, since the in-progress phrasing now belongs to the new `-title` keys)

- [ ] **Step 2: Edit `transfer-limit-command-handler.service.ts` `handleToggle()` (lines 52-60)**

```ts
  private async handleToggle(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    const state = await this.qbService.transfer.speedLimitsMode(serverId);
    const key = state
      ? 'services.transfer-limit-command-handler.info.alternative-limit-off'
      : 'services.transfer-limit-command-handler.info.alternative-limit-on';
    this.toastService.info(
      this.translateService.instant(key),
      this.translateService.instant(`${key}-title`),
    );
    await this.qbService.transfer.toggleSpeedLimitsMode(serverId);
  }
```

(reusing `key` with a `-title` suffix guarantees the title and message always describe the same state - see Self-Review item 4 for the polarity verification)

- [ ] **Step 3: Update the 2 affected tests in `transfer-limit-command-handler.service.spec.ts`**

Replace the test at lines 51-57:

```ts
it('should show info toast on toggle', async () => {
  commands$.next({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
  await flushPromises();
  expect(toastInfo).toHaveBeenCalledWith(
    'services.transfer-limit-command-handler.info.alternative-limit-on',
    'services.transfer-limit-command-handler.info.alternative-limit-on-title',
  );
});
```

Replace the test at lines 59-66:

```ts
it('should show "OFF" toast when alt speed is currently enabled', async () => {
  getAltState.mockResolvedValueOnce(true);
  commands$.next({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
  await flushPromises();
  expect(toastInfo).toHaveBeenCalledWith(
    'services.transfer-limit-command-handler.info.alternative-limit-off',
    'services.transfer-limit-command-handler.info.alternative-limit-off-title',
  );
});
```

- [ ] **Step 4: Run the suite to verify the updated tests pass**

Run: `npm test --workspace=packages/app -- transfer-limit-command-handler`
Expected: PASS

- [ ] **Step 5: Run the full regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/services/transfer-limit-command-handler.service.ts packages/app/src/app/services/transfer-limit-command-handler.service.spec.ts public/i18n/us.json
git commit -m "#178: retitle transfer-limit-command-handler toggle toast"
```

---

### Task 11: `qb.service.ts` - fix connection-retry severity

**Files:**

- Modify: `packages/app/src/app/services/qb.service.ts:754`
- Test (regression only): `packages/app/src/app/services/qb.service.spec.ts` - confirmed via grep (`ToastService\|toastService\|retrying\|retry`) that no test exercises the retry path or asserts on `.danger`/`.warning`; its `ToastService` mock only provides `{ danger: vi.fn() }`, which is unused by any assertion today.

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new. No i18n text changes - only the method called changes.

- [ ] **Step 1: Edit `qb.service.ts` line 754**

```ts
if (!options?.suppressErrors) {
  this.toastService.warning(
    this.translateService.instant('services.qb.warning.connection-retry-message'),
    this.translateService.instant('services.qb.warning.connection-retry-title'),
  );
}
```

(was `this.toastService.danger(`; the i18n keys already live under `warning.*` with title "Connection Issue" - this just makes the visual severity match)

- [ ] **Step 2: Run the regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/services/qb.service.ts
git commit -m "#178: use warning severity for qb.service connection-retry toast"
```

---

## Self-Review

**1. Spec coverage:** Every row of the spec's "Structural fixes" table has a task: manage-tags (Task 1), manage-categories (Task 2), torrent-exists (Task 3), server-command-handler (Task 4), settings (Task 5), qb-settings (Task 6), update-command-handler (Task 7), content (Task 8), ui-command-handler showing-file/opening-folder/connect-failed (Task 9, server-switch explicitly left unchanged per the transient exemption), transfer-limit-command-handler (Task 10). The `qb.service.ts` severity fix is Task 11. All three "Minor cleanup" items are covered: settings.ts try/catch (Task 5), `ToastService.error()` removal (Task 6), torrent-exists.ts try/catch (Task 3). No gaps.

**2. Ambiguities resolved (judgment calls made, documented here so a reviewer can see they were deliberate):**

- **`server-command-handler` `updated` severity:** kept `.info()` exactly as today - the spec's table only changes the title/message shape for this row, not the severity, and `handleServerAdded`/`handleServerDeleted` keep their existing `.success()`/`.info()` calls too.
- **`settings.ts` title source:** confirmed the _current_ default `.success()` title is the generic "Success" (`general.toast.success`, `us.json:1702`), not "Settings Saved" - so an explicit title argument is required, not just a default-title rename. Same reasoning applies to `qb-settings.ts` (Task 6) and `update-command-handler.ts` (Task 7).
- **Quoting `{{path}}`/`{{name}}` in `ui-command-handler.ts` (Task 9):** the spec's table literally shows the new message as `{{path}}`/`{{name}}` with no quote marks, but the spec's general message rule says "names and paths are quoted". Chose to quote them (`` `"${path}"` ``), for consistency with every other quoted-value message in this plan (manage-tags, manage-categories, server-command-handler) - an unquoted bare path/name would be the only inconsistent case in the whole plan.
- **Two `ui-command-handler.ts` call sites excluded from Task 9:** (a) the bare `.catch((error: any) => { this.toastService.danger(error); })` at the end of the `UI_OPEN_DESTINATION` promise chain (lines 287-289) passes the raw error _object_ (not `.message`) as the message and has no title at all - this is a real latent bug, but it is not listed in the spec's structural-fixes table, so it's left untouched here and flagged as a likely candidate for a future coverage-gap plan. (b) `remote-path-missing`/`local-path-unresolved` (lines 241-246, 259-266) are also absent from the spec's table and from its "already-correct" exclusion list - read as table-silence meaning "leave alone" rather than an oversight, since both already have specific (if generic-toned) messages and no obviously wrong title, left untouched.
- **`transfer-limit-command-handler` state polarity:** verified `state` is the _current_ (pre-toggle) value, and the existing ternary already picks the key describing the state being _entered_ (e.g. `state === true` → "alternative-limit-off" key, since toggling turns it off). The new title reuses the exact same `key` variable with a `-title` suffix, so title and message can never desync on which state they describe.
- **`ToastService.error()` removal safety:** confirmed via `grep -rn "toastService\.error\|\.error("` across `packages/app/src` that `qb-settings.ts:126` is the only caller, and via reading `toast.service.spec.ts` that no test references `.error(` directly - the method can be deleted with zero other call-site or test fallout.

**3. Placeholder scan:** No "TBD"/"TODO"/"similar to Task N" patterns. Every step shows literal before/after code or JSON. Every "no spec changes needed" claim is backed by a stated grep or a description of what the existing mock/assertions do (or don't) cover, not asserted without support.

**4. Type consistency:** Every catch parameter that newly needs `.message` access is typed `(err: any)` or `(e: any)`, matching the existing codebase convention in `rename-torrent.ts`/`general.ts` (Tasks 1, 2, 3, 5, 6, 8). The one catch parameter left untyped (`ui-command-handler.ts`'s `handleServerSwitch`, Task 9) never reads `.message`, so no annotation change is needed there. All new i18n keys consistently use the `-title` suffix for title keys, with no name collisions against existing sibling keys (verified by reading each `us.json` block before editing it).

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-21-toast-structural-fixes.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
