# Toast Coverage Gaps - Shared Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the toast-feedback gap in the four shared modals that today only
`console.error` on failure and give the user no indication anything went
wrong - `SetTorrentTags`, `SetTorrentCategory`, `ShareLimit`, `TransferLimit`

- per the "Shared modals" subsection of
  `docs/superpowers/specs/2026-06-21-toast-consistency-design.md`. Also fixes a
  real bug in `TransferLimit` where the modal closes even when the save fails,
  hiding the failure entirely.

**Architecture:** Each modal already has a `try { ...; this.activeModal.close(); } catch { console.error(...) } finally { this.saving.set(false); }`
shape (three of the four already close inside `try`, correctly). This plan
adds `ToastService`/`TranslateService` injection (none of the four currently
inject either), a danger toast in each catch block using the established
"raw caught error as message, specific `-title` key as title" convention, and

- for `TransferLimit` only - moves `activeModal.close()` out of `finally`
  and into `try`, matching the structure the other three already have. No
  success toast is added anywhere - the modal closing already confirms success,
  matching `rename-torrent.ts`/`set-torrent-location.ts`.

**Tech Stack:** Angular 20 (`@ngx-translate/core`, `@ng-bootstrap/ng-bootstrap`),
`us.json` flat-nested JSON i18n resource, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Message convention: pass `error?.message ?? String(error)` directly as the
  toast message (no i18n key) - the established "raw caught error" pattern
  already used in `rename-torrent.ts`, `set-torrent-location.ts`, and every
  task of the structural-fixes plan (`2026-06-21-toast-structural-fixes.md`).
- Title convention: one new i18n key per modal under its own existing title
  namespace, using the `-title` suffix convention, named `toast.set-failed-title`
  in all four (each modal only gets one new toast call site, so there's no
  sibling key to disambiguate against).
- No success toast in this plan - per spec, the modal closing on success is
  itself the confirmation. Do not add `.success()` calls anywhere here.
- `TranslateService` is provided globally with no loader by
  `packages/app/src/test-providers.ts` (confirmed by reading Plan 1's Global
  Constraints and verifying no spec file in this plan's scope overrides it) -
  `translateService.instant(key)` returns the raw key string in every test,
  so test assertions against the title argument use the literal key string,
  not English text. Do not add a `TranslateService` mock to any spec file in
  this plan.
- `ToastService` is NOT globally mocked - every modal under test needs its own
  `{ provide: ToastService, useValue: { danger: vi.fn() } }` in
  `TestBed.configureTestingModule`, matching the existing pattern in
  `rename-torrent.spec.ts:30`. None of the four spec files in this plan
  currently provide `ToastService` at all.
- Run `npm test --workspace=packages/app -- <filter>` after each task's
  implementation step, then the full `npm test --workspace=packages/app`
  before committing. Pre-commit hooks (Husky + lint-staged) auto-format
  `*.ts`/`*.json` files with Prettier on commit.
- Commit format: `#178: <short description>` (continuing the
  `178-revise-toast-hardcoded-english-messages` branch convention).
- Out of scope: `TorrentCommandHandlerService` and the grid context-menu
  clipboard actions (a separate plan covers those), and anything already
  handled by Plan 1 (casing) or Plan 2 (structural retitling).

---

### Task 1: `SetTorrentTags` - add the missing failure toast

**Files:**

- Modify: `packages/app/src/app/components/modals/set-torrent-tags/set-torrent-tags.ts:13` (import), `:31-33` (injects), `:95-99` (catch block)
- Modify: `public/i18n/us.json:295-297` (`components.modals.set-torrent-tags`)
- Test: `packages/app/src/app/components/modals/set-torrent-tags/set-torrent-tags.spec.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new - `handleSubmit()` keeps its `Promise<void>` signature.

- [ ] **Step 1: Edit `us.json:295-297` - add the failure-title key**

```json
      "set-torrent-tags": {
        "title": "Set Torrent Tags",
        "toast": {
          "set-failed-title": "Failed to Set Torrent Tags"
        }
      },
```

- [ ] **Step 2: Write the failing test**

In `set-torrent-tags.spec.ts`, add `ToastService` to the imports (line 6, after the `ServerStoreService` import):

```ts
import { ToastService } from '../../../services/toast.service';
```

Add a provider to the `providers` array in `beforeEach` (after the `QbService` provider, before the closing `]`):

```ts
        { provide: ToastService, useValue: { danger: vi.fn() } },
```

Add this test inside the existing `describe('handleSubmit', ...)` block, after the existing test:

```ts
it('should show a danger toast with the raw error when addTags fails', async () => {
  const mockQbService = TestBed.inject(QbService) as unknown as {
    torrents: { addTags: ReturnType<typeof vi.fn>; removeTags: ReturnType<typeof vi.fn> };
  };
  const mockToastService = TestBed.inject(ToastService) as unknown as {
    danger: ReturnType<typeof vi.fn>;
  };
  mockQbService.torrents.addTags.mockRejectedValueOnce(new Error('disk full'));
  await component.ngOnInit();
  component.setTorrentTagsForm.get('tags')?.setValue(['action', 'drama']);

  await component.handleSubmit();

  expect(mockToastService.danger).toHaveBeenCalledWith(
    'disk full',
    'components.modals.set-torrent-tags.toast.set-failed-title',
  );
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test --workspace=packages/app -- set-torrent-tags`
Expected: FAIL - `handleSubmit()`'s catch block only `console.error`s today, so `mockToastService.danger` is never called.

- [ ] **Step 4: Edit `set-torrent-tags.ts`**

Change the import on line 13 from:

```ts
import { TranslatePipe } from '@ngx-translate/core';
```

to:

```ts
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
```

Add to the injects (after line 32's `qbService`, before line 33's `activeModal`):

```ts
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
```

And add the import for `ToastService` near the other relative imports (after the `TagSelect` import):

```ts
import { ToastService } from '../../../services/toast.service';
```

Change the catch block (lines 95-99) from:

```ts
    } catch (error) {
      console.error(SetTorrentTags.name, 'handleSubmit', 'Failed to set torrent tags!', error);
    } finally {
      this.saving.set(false);
    }
```

to:

```ts
    } catch (error: any) {
      console.error(SetTorrentTags.name, 'handleSubmit', 'Failed to set torrent tags!', error);
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant('components.modals.set-torrent-tags.toast.set-failed-title'),
      );
    } finally {
      this.saving.set(false);
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=packages/app -- set-torrent-tags`
Expected: PASS (including the existing "should apply tag changes..." test, unaffected)

- [ ] **Step 6: Run the full regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/modals/set-torrent-tags/set-torrent-tags.ts packages/app/src/app/components/modals/set-torrent-tags/set-torrent-tags.spec.ts public/i18n/us.json
git commit -m "#178: add missing failure toast to SetTorrentTags"
```

---

### Task 2: `SetTorrentCategory` - add the missing failure toast

**Files:**

- Modify: `packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.ts:13` (import), `:39-41` (injects), `:69-75` (catch block)
- Modify: `public/i18n/us.json:283-285` (`components.modals.set-torrent-category`)
- Test: `packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.spec.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new - `handleSubmit()` keeps its `Promise<void>` signature.

- [ ] **Step 1: Edit `us.json:283-285` - add the failure-title key**

```json
      "set-torrent-category": {
        "title": "Set Torrent Category",
        "toast": {
          "set-failed-title": "Failed to Set Category"
        }
      },
```

(per spec, this title omits "Torrent" - kept verbatim even though it reads
slightly asymmetric to the other three modals in this plan)

- [ ] **Step 2: Write the failing test**

In `set-torrent-category.spec.ts`, add `ToastService` to the imports (after the `ServerStoreService` import):

```ts
import { ToastService } from '../../../services/toast.service';
```

Add a provider to the `providers` array in `beforeEach` (after the `QbService` provider):

```ts
        { provide: ToastService, useValue: { danger: vi.fn() } },
```

Add this test inside the existing `describe('handleSubmit', ...)` block, after the existing "should abort the submit if the category cannot be created" test:

```ts
it('should show a danger toast with the raw error when setCategory fails', async () => {
  const mockQbService = TestBed.inject(QbService) as unknown as {
    torrents: { setCategory: ReturnType<typeof vi.fn> };
  };
  const mockToastService = TestBed.inject(ToastService) as unknown as {
    danger: ReturnType<typeof vi.fn>;
  };
  mockQbService.torrents.setCategory.mockRejectedValueOnce(new Error('disk full'));
  component.setTorrentCategoryForm.get('category')?.setValue('tv');

  await component.handleSubmit();

  expect(mockToastService.danger).toHaveBeenCalledWith(
    'disk full',
    'components.modals.set-torrent-category.toast.set-failed-title',
  );
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test --workspace=packages/app -- set-torrent-category`
Expected: FAIL - the catch block only `console.error`s today.

- [ ] **Step 4: Edit `set-torrent-category.ts`**

Change the import on line 13 from:

```ts
import { TranslatePipe } from '@ngx-translate/core';
```

to:

```ts
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
```

Add to the injects (lines 39-41, after `qbService`):

```ts
  private readonly serverStoreService = inject(ServerStoreService);
  public readonly activeModal = inject(NgbActiveModal);
  public readonly qbService = inject(QbService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
```

And add the import for `ToastService` near the other relative imports (after the `CategorySelect` import):

```ts
import { ToastService } from '../../../services/toast.service';
```

Change the catch block (lines 69-75) from:

```ts
    } catch (error) {
      console.error(
        SetTorrentCategory.name,
        'handleSubmit',
        'Failed to set torrent category!',
        error,
      );
    } finally {
      this.saving = false;
    }
```

to:

```ts
    } catch (error: any) {
      console.error(
        SetTorrentCategory.name,
        'handleSubmit',
        'Failed to set torrent category!',
        error,
      );
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.set-torrent-category.toast.set-failed-title',
        ),
      );
    } finally {
      this.saving = false;
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=packages/app -- set-torrent-category`
Expected: PASS (including the existing "should abort the submit if the category cannot be created" test, which only asserts `setCategory` was not called and `saving` is `false` - unaffected by the new toast call)

- [ ] **Step 6: Run the full regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.ts packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.spec.ts public/i18n/us.json
git commit -m "#178: add missing failure toast to SetTorrentCategory"
```

---

### Task 3: `ShareLimit` - add the missing failure toast

**Files:**

- Modify: `packages/app/src/app/components/modals/share-limit/share-limit.ts:12` (import), `:38-41` (injects), `:139-143` (catch block)
- Modify: `public/i18n/us.json:666-670` (`components.modals.share-limit`)
- Test: `packages/app/src/app/components/modals/share-limit/share-limit.spec.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new - `handleSubmit()` keeps its `Promise<void>` signature.

- [ ] **Step 1: Edit `us.json:666-670` - add the failure-title key**

```json
      "share-limit": {
        "title": "Share Limit",
        "global": "Global Share Limit",
        "loading": "Loading Share Limits...",
        "toast": {
          "set-failed-title": "Failed to Set Share Limits"
        }
      },
```

- [ ] **Step 2: Write the failing test**

In `share-limit.spec.ts`, add `ToastService` to the imports (after the `ServerStoreService` import):

```ts
import { ToastService } from '../../../services/toast.service';
```

Add a describe-level variable next to `mockQbService` (line 26):

```ts
let mockToastService: { danger: ReturnType<typeof vi.fn> };
```

Initialize it in `beforeEach` (after `mockQbService` is assigned, before `torrentsMap = makeStore(...)`):

```ts
mockToastService = { danger: vi.fn() };
```

Add it to the `providers` array (after the `QbService` provider):

```ts
        { provide: ToastService, useValue: mockToastService },
```

Add this test inside the existing `describe('handleSubmit - torrent target', ...)` block, after the existing test:

```ts
it('shows a danger toast with the raw error when setShareLimits fails', async () => {
  fixture.componentRef.setInput('target', 'torrent');
  fixture.componentRef.setInput('hashes', ['abc123']);
  mockQbService.torrents.setShareLimits.mockRejectedValueOnce(new Error('disk full'));

  await component.handleSubmit();

  expect(mockToastService.danger).toHaveBeenCalledWith(
    'disk full',
    'components.modals.share-limit.toast.set-failed-title',
  );
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test --workspace=packages/app -- share-limit`
Expected: FAIL - the catch block only `console.error`s today (note: this matches both `components/modals/share-limit/share-limit.spec.ts` and the unrelated `components/share-limit/share-limit.spec.ts` form component's tests if that filter is too broad - use the full relative path if needed: `npm test --workspace=packages/app -- modals/share-limit`)

- [ ] **Step 4: Edit `share-limit.ts`**

Change the import on line 12 from:

```ts
import { TranslatePipe } from '@ngx-translate/core';
```

to:

```ts
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
```

Add to the injects (lines 38-41, after `torrentStoreService`):

```ts
  public readonly activeModal = inject(NgbActiveModal);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
```

And add the import for `ToastService` near the other relative imports (after the `BbSpinner` import):

```ts
import { ToastService } from '../../../services/toast.service';
```

Change the catch block (lines 139-143) from:

```ts
    } catch (error) {
      console.error(ShareLimit.name, 'handleSubmit', 'Failed to set share limits!', error);
    } finally {
      this.saving.set(false);
    }
```

to:

```ts
    } catch (error: any) {
      console.error(ShareLimit.name, 'handleSubmit', 'Failed to set share limits!', error);
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant('components.modals.share-limit.toast.set-failed-title'),
      );
    } finally {
      this.saving.set(false);
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=packages/app -- modals/share-limit`
Expected: PASS (including the existing "calls setShareLimits with component hashes" test, unaffected)

- [ ] **Step 6: Run the full regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/modals/share-limit/share-limit.ts packages/app/src/app/components/modals/share-limit/share-limit.spec.ts public/i18n/us.json
git commit -m "#178: add missing failure toast to ShareLimit"
```

---

### Task 4: `TransferLimit` - fix the close-on-error bug and add the missing failure toast

**Files:**

- Modify: `packages/app/src/app/components/modals/transfer-limit/transfer-limit.ts:12` (import), `:44-47` (injects), `:108-122` (try/catch/finally)
- Modify: `public/i18n/us.json:245-249` (`components.modals.transfer-limit`)
- Test: `packages/app/src/app/components/modals/transfer-limit/transfer-limit.spec.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new - `handleSubmit()` keeps its `Promise<void>` signature.

- [ ] **Step 1: Edit `us.json:245-249` - add the failure-title key**

```json
      "transfer-limit": {
        "title": "Transfer Limit",
        "global": "Global Transfer Limit",
        "loading": "Loading Transfer Limits...",
        "toast": {
          "set-failed-title": "Failed to Set Transfer Limits"
        }
      },
```

- [ ] **Step 2: Write the failing tests**

In `transfer-limit.spec.ts`, add `ToastService` to the imports (after the `ServerStoreService` import):

```ts
import { ToastService } from '../../../services/toast.service';
```

Add a describe-level variable next to `mockQbService` (line 19):

```ts
let mockToastService: { danger: ReturnType<typeof vi.fn> };
```

Initialize it in `beforeEach` (after `mockQbService` is assigned, before `torrentsMap = makeStore(...)`):

```ts
mockToastService = { danger: vi.fn() };
```

Add it to the `providers` array (after the `QbService` provider):

```ts
        { provide: ToastService, useValue: mockToastService },
```

Add these two tests inside the existing `describe('handleSubmit - torrent target', ...)` block, after the existing test:

```ts
it('shows a danger toast with the raw error when setUploadLimit fails', async () => {
  mockQbService.torrents.setUploadLimit.mockRejectedValueOnce(new Error('disk full'));
  component.form.controls.transferRateLimits.setValue({
    uploadLimit: 512,
    downloadLimit: 1024,
  });

  await component.handleSubmit();

  expect(mockToastService.danger).toHaveBeenCalledWith(
    'disk full',
    'components.modals.transfer-limit.toast.set-failed-title',
  );
});

it('does not close the modal when saving fails', async () => {
  mockQbService.torrents.setUploadLimit.mockRejectedValueOnce(new Error('disk full'));
  component.form.controls.transferRateLimits.setValue({
    uploadLimit: 512,
    downloadLimit: 1024,
  });

  await component.handleSubmit();

  expect(mockActiveModal.close).not.toHaveBeenCalled();
  expect(component.saving()).toBe(false);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test --workspace=packages/app -- modals/transfer-limit`
Expected: FAIL on both new tests - today's catch block only `console.error`s
(no toast), and today's `finally` block unconditionally calls
`this.activeModal.close()` even after a rejected `Promise.all`, so the
"does not close the modal when saving fails" assertion fails too.

- [ ] **Step 4: Edit `transfer-limit.ts`**

Change the import on line 12 from:

```ts
import { TranslatePipe } from '@ngx-translate/core';
```

to:

```ts
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
```

Add to the injects (lines 44-47, after `torrentStoreService`):

```ts
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  public activeModal = inject(NgbActiveModal);
```

And add the import for `ToastService` near the other relative imports (after the `BbSpinner` import, before the `TransferLimit as TransferLimitForm` import):

```ts
import { ToastService } from '../../../services/toast.service';
```

Change `handleSubmit()`'s try/catch/finally (lines 108-122) from:

```ts
try {
  await Promise.all([
    isGlobal
      ? this.qbService.transfer.setUploadLimit(serverId, uploadBytes)
      : this.qbService.torrents.setUploadLimit(serverId, uploadBytes, hashes),
    isGlobal
      ? this.qbService.transfer.setDownloadLimit(serverId, downloadBytes)
      : this.qbService.torrents.setDownloadLimit(serverId, downloadBytes, hashes),
  ]);
} catch (error: any) {
  console.error(TransferLimit.name, 'handleSubmit', 'Failed to update limits!');
} finally {
  this.saving.set(false);
  this.activeModal.close();
}
```

to:

```ts
try {
  await Promise.all([
    isGlobal
      ? this.qbService.transfer.setUploadLimit(serverId, uploadBytes)
      : this.qbService.torrents.setUploadLimit(serverId, uploadBytes, hashes),
    isGlobal
      ? this.qbService.transfer.setDownloadLimit(serverId, downloadBytes)
      : this.qbService.torrents.setDownloadLimit(serverId, downloadBytes, hashes),
  ]);
  this.activeModal.close();
} catch (error: any) {
  console.error(TransferLimit.name, 'handleSubmit', 'Failed to update limits!', error);
  this.toastService.danger(
    error?.message ?? String(error),
    this.translateService.instant('components.modals.transfer-limit.toast.set-failed-title'),
  );
} finally {
  this.saving.set(false);
}
```

(`activeModal.close()` moves from `finally` into `try`, right after the
awaited calls succeed - `finally` now only resets `saving`, matching the
structure `SetTorrentTags`/`SetTorrentCategory`/`ShareLimit` already have;
`console.error` also now passes `error` as a 4th argument, matching the other
three modals' calls - it was the only one of the four omitting it)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace=packages/app -- modals/transfer-limit`
Expected: PASS (including the existing "calls setUploadLimit and
setDownloadLimit with component hashes" test, unaffected since it exercises
the success path)

- [ ] **Step 6: Run the full regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/modals/transfer-limit/transfer-limit.ts packages/app/src/app/components/modals/transfer-limit/transfer-limit.spec.ts public/i18n/us.json
git commit -m "#178: fix close-on-error bug and add missing failure toast to TransferLimit"
```

---

## Self-Review

**1. Spec coverage:** All four modals in the spec's "Shared modals" subsection
have a task: `SetTorrentTags` (Task 1), `SetTorrentCategory` (Task 2),
`ShareLimit` (Task 3), `TransferLimit` (Task 4, including its `close()`-in-
`finally` bug fix). Every modal gets exactly the danger-toast title specified
verbatim in the spec ("Failed to Set Torrent Tags", "Failed to Set Category",
"Failed to Set Share Limits", "Failed to Set Transfer Limits") with the raw
caught error as the message, and no success toast. No gaps.

**2. Ambiguities resolved:**

- **`SetTorrentCategory`'s asymmetric title** ("Failed to Set Category", no
  "Torrent"): kept verbatim per the spec's literal wording rather than
  "normalizing" it to match the other three - the spec author's word choice
  for this one title is deliberate enough to preserve as-is.
- **Test file path collision risk for `ShareLimit`:** there are two
  `share-limit.spec.ts` files in the repo (`components/share-limit/` - the
  reusable form, and `components/modals/share-limit/` - the modal this plan
  touches). A bare `-- share-limit` test filter would match both; steps use
  the more specific `-- modals/share-limit` filter to avoid running (and
  reporting on) the unrelated form component's tests.
- **`TransferLimit`'s `console.error` missing its `error` argument:** today's
  call is `console.error(TransferLimit.name, 'handleSubmit', 'Failed to
update limits!')` with no 4th argument, unlike the other three modals which
  all pass `error` as a 4th argument. Since this line is already being
  touched to fix the close-on-error bug, the inconsistency is fixed in the
  same edit rather than left as a second, separate diff.
- **`ToastService`/`TranslateService` test setup:** confirmed via
  `rename-torrent.spec.ts:30` that `TranslateService` needs no mock (it's
  globally provided with no loader, so `.instant(key)` returns the raw key)
  and only `ToastService` needs a per-spec provider. Used the inline
  `useValue: { danger: vi.fn() }` + `TestBed.inject(ToastService)` pattern
  for `set-torrent-tags.spec.ts`/`set-torrent-category.spec.ts` (matching
  their existing convention of inline provider values), and a describe-level
  `mockToastService` variable for `share-limit.spec.ts`/`transfer-limit.spec.ts`
  (matching their existing convention of a describe-level `mockQbService`
  variable used the same way).

**3. Placeholder scan:** No "TBD"/"TODO"/"similar to Task N" patterns. Every
step shows literal before/after code or JSON. Every claim about existing
tests being unaffected names the specific test and why (it exercises the
success path, or asserts on something the new code doesn't touch).

**4. Type consistency:** All four catch blocks now use `catch (error: any)`
(two of the four were previously untyped `catch (error)`, which TypeScript's
`useUnknownInCatchVariables` would type as `unknown`, blocking `.message`
access - explicitly annotated `: any` to match `error?.message ?? String(error)`,
consistent with every catch block across Plans 1 and 2). All four new
`toastService.danger(...)` calls use the identical two-argument shape (raw
error message, then `translateService.instant(titleKey)`), and all four new
i18n keys use the same `toast.set-failed-title` name under each modal's own
existing namespace - no naming drift between tasks.

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-21-toast-coverage-shared-modals.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
