# Torrent-Exists Modal Footer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `TorrentExists` modal footer fit on one row at the default modal size regardless of translation length, then remove the `size: 'lg'` workaround.

**Architecture:** Pure template/TypeScript edits to the existing `TorrentExists` modal and the two `AddTorrent` call sites that open it. No new components, services, or CSS.

**Tech Stack:** Angular 20 (standalone components, signals), ng-bootstrap `NgbTooltip`, `@fortawesome/angular-fontawesome`, `@ngx-translate/core`, Vitest via `@angular/build:unit-test`.

## Global Constraints

- Footer must fit on a single row at the **default** (non-`lg`) modal size, regardless of translation length.
- No new CSS - rely on existing `.btn-split` styles and Bootstrap's built-in `me-auto` utility.
- No new reusable "icon-only button" component or class - this is a one-off pattern for this single button.
- No change to `deleteTorrentFile()` behavior (still deletes immediately on click, no added confirmation step).
- Reuse the existing `components.modals.torrent-exists.button.delete-file` translation key for the tooltip/aria-label - do not add a new key.
- Use `-` (hyphen), never `—` (em dash), in commit messages.
- Commit format: `#180: short description`.

---

### Task 1: Icon-only Delete button in the TorrentExists footer

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-exists/torrent-exists.html:103-116`
- Modify: `packages/app/src/app/components/modals/torrent-exists/torrent-exists.ts` (imports + `@Component.imports`)
- Test: `packages/app/src/app/components/modals/torrent-exists/torrent-exists.spec.ts`

**Interfaces:**

- Consumes: existing `showDeleteButton()` computed, `fileDeleted()` signal, `deleteTorrentFile()` method, and `icons.faTrashCan` - all already defined in `torrent-exists.ts`. No signatures change.
- Produces: nothing consumed by other tasks - this task is self-contained.

- [ ] **Step 1: Write the failing tests**

  Open `packages/app/src/app/components/modals/torrent-exists/torrent-exists.spec.ts`.

  Add a `Torrent` import next to the existing model import (after line 5, `import { DEFAULT_GENERAL_SETTINGS } ...`):

  ```ts
  import { Torrent } from '../../../models/torrent.model';
  ```

  Add a `makeTorrent` factory after the imports, before `describe('TorrentExists', ...)` (i.e. after line 12):

  ```ts
  const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent => ({
    added_on: 1700000000,
    amount_left: 0,
    auto_tmm: false,
    availability: 0,
    category: '',
    completed: 0,
    completion_on: 0,
    content_path: '',
    dl_limit: 0,
    dlspeed: 0,
    download_path: '',
    downloaded: 0,
    downloaded_session: 0,
    eta: 0,
    f_l_piece_prio: false,
    force_start: false,
    hash: 'abc123',
    inactive_seeding_time_limit: 0,
    infohash_v1: '',
    infohash_v2: '',
    last_activity: 0,
    magnet_uri: '',
    max_inactive_seeding_time: 0,
    max_ratio: 0,
    max_seeding_time: 0,
    name: 'My Torrent',
    num_complete: 0,
    num_incomplete: 0,
    num_leechs: 0,
    num_seeds: 0,
    priority: 0,
    progress: 0,
    ratio: 0,
    ratio_limit: 0,
    save_path: '',
    seeding_time: 0,
    seeding_time_limit: 0,
    seen_complete: 0,
    seq_dl: false,
    size: 0,
    state: 'downloading',
    super_seeding: false,
    tags: '',
    time_active: 0,
    total_size: 0,
    tracker: '',
    trackers_count: 0,
    up_limit: 0,
    uploaded: 0,
    uploaded_session: 0,
    upspeed: 0,
    ...overrides,
  });
  ```

  Inside `describe('TorrentExists', () => { ... })`, add a new nested `describe` immediately after the `describe('openDetails', ...)` block (i.e. right before the outer describe's closing `});` that currently sits at line 184-185):

  ```ts
  describe('delete button rendering', () => {
    let footerFixture: ComponentFixture<TorrentExists>;

    beforeEach(() => {
      const torrentMap = new Map([['abc123', makeTorrent({ hash: 'abc123' })]]);
      (mockTorrentStore as any).torrentsMap = signal(torrentMap);

      footerFixture = TestBed.createComponent(TorrentExists);
      footerFixture.componentRef.setInput('hash', 'abc123');
      footerFixture.componentRef.setInput('originalPath', '/tmp/test.torrent');
      footerFixture.detectChanges();
    });

    it('should render the delete button icon-only with an aria-label and no visible text', () => {
      const deleteButton: HTMLButtonElement = footerFixture.nativeElement.querySelector(
        '.modal-footer .btn-danger',
      );

      expect(deleteButton.textContent?.trim()).toBe('');
      expect(deleteButton.getAttribute('aria-label')).toBe(
        'components.modals.torrent-exists.button.delete-file',
      );
      expect(deleteButton.querySelector('fa-icon')).toBeTruthy();
    });

    it('should pin the delete button to the left with me-auto and drop btn-split', () => {
      const deleteButton: HTMLButtonElement = footerFixture.nativeElement.querySelector(
        '.modal-footer .btn-danger',
      );

      expect(deleteButton.classList.contains('me-auto')).toBe(true);
      expect(deleteButton.classList.contains('btn-split')).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run (from the repo root):

  ```bash
  cd packages/app && npx ng test --watch=false --include src/app/components/modals/torrent-exists/torrent-exists.spec.ts
  ```

  Expected: the two new tests in `delete button rendering` FAIL -
  - `textContent?.trim()` is the literal key (not `''`), because the button still renders `bb-btn-content` text.
  - `getAttribute('aria-label')` is `null`.
  - `classList.contains('me-auto')` is `false`; `classList.contains('btn-split')` is `true`.

- [ ] **Step 3: Implement the minimal template and import changes**

  In `packages/app/src/app/components/modals/torrent-exists/torrent-exists.ts`, add the FontAwesome module import next to the existing icon import:

  ```ts
  import { faCircleInfo, faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
  ```

  becomes:

  ```ts
  import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
  import { faCircleInfo, faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
  ```

  And add `FontAwesomeModule` to the `@Component.imports` array (alongside the existing `BbBtnContent`):

  ```ts
  imports: [
    LocalTimestampPipe,
    FilesizePipe,
    RatioPipe,
    AutofocusDirective,
    TooltipOverflow,
    TimeagoPipe,
    NgbTooltip,
    TranslatePipe,
    BbProgress,
    BbBtnContent,
    FontAwesomeModule,
  ],
  ```

  In `packages/app/src/app/components/modals/torrent-exists/torrent-exists.html`, replace the delete button block (lines 103-116):

  ```html
  @if (showDeleteButton()) {
  <button
    type="button"
    class="btn btn-danger btn-sm btn-split"
    [disabled]="fileDeleted()"
    (click)="deleteTorrentFile()"
  >
    <bb-btn-content
      [icon]="icons.faTrashCan"
      [text]="'components.modals.torrent-exists.button.delete-file' | translate"
      position="end"
    ></bb-btn-content>
  </button>
  }
  ```

  with:

  ```html
  @if (showDeleteButton()) {
  <button
    type="button"
    class="btn btn-danger btn-sm me-auto"
    [disabled]="fileDeleted()"
    [ngbTooltip]="'components.modals.torrent-exists.button.delete-file' | translate"
    [attr.aria-label]="'components.modals.torrent-exists.button.delete-file' | translate"
    placement="top"
    tooltipClass="single-line-tooltip"
    (click)="deleteTorrentFile()"
  >
    <fa-icon [icon]="icons.faTrashCan" aria-hidden="true"></fa-icon>
  </button>
  }
  ```

  Leave the "Open Details" and "Close" buttons exactly as they are.

- [ ] **Step 4: Run the tests to verify they pass**

  Run:

  ```bash
  cd packages/app && npx ng test --watch=false --include src/app/components/modals/torrent-exists/torrent-exists.spec.ts
  ```

  Expected: all tests in the file PASS, including the two new ones.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/app/src/app/components/modals/torrent-exists/torrent-exists.html packages/app/src/app/components/modals/torrent-exists/torrent-exists.ts packages/app/src/app/components/modals/torrent-exists/torrent-exists.spec.ts
  git commit -m "#180: made torrent-exists delete button icon-only to fit the footer on one row"
  ```

---

### Task 2: Revert the `size: 'lg'` workaround in AddTorrent

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/add-torrent.ts:380` and `:499`

**Interfaces:**

- Consumes: nothing from Task 1 directly - this only depends on Task 1 having already fixed the footer width, which is why this revert no longer causes wrapping.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Confirm the existing tests are currently failing (red)**

  Run:

  ```bash
  cd packages/app && npx ng test --watch=false --include src/app/components/add-torrent/add-torrent.spec.ts
  ```

  Expected: 2 tests FAIL -
  - `AddTorrent > handleSubmit > should open the TorrentExists modal and consume the draft on a 409 conflict`
  - `AddTorrent > loading pending drafts > should open the TorrentExists modal and consume the draft when the torrent is already in the list`

  Both fail because `modalService.open` was called with `{ centered: true, size: 'lg' }` but the test expects `{ centered: true }`.

- [ ] **Step 2: Revert the workaround**

  In `packages/app/src/app/components/add-torrent/add-torrent.ts`, line 380:

  ```ts
  const modalRef = this.modalService.open(TorrentExists, { centered: true, size: 'lg' });
  ```

  becomes:

  ```ts
  const modalRef = this.modalService.open(TorrentExists, { centered: true });
  ```

  And line 499, the same change:

  ```ts
  const modalRef = this.modalService.open(TorrentExists, { centered: true, size: 'lg' });
  ```

  becomes:

  ```ts
  const modalRef = this.modalService.open(TorrentExists, { centered: true });
  ```

- [ ] **Step 3: Run the tests to verify they pass**

  Run:

  ```bash
  cd packages/app && npx ng test --watch=false --include src/app/components/add-torrent/add-torrent.spec.ts
  ```

  Expected: all tests PASS (69/69), including the two that were failing in Step 1.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/app/src/app/components/add-torrent/add-torrent.ts
  git commit -m "#180: reverted lg modal size workaround now that the footer fits at default size"
  ```

---

### Task 3: Final verification and spec/plan cleanup

**Files:**

- Delete: `docs/superpowers/` (entire folder - both the spec and this plan)

**Interfaces:**

- Consumes: completed Task 1 and Task 2.
- Produces: nothing - this is the final task.

- [ ] **Step 1: Run the full app test suite and lint**

  Run:

  ```bash
  cd packages/app && npx ng test --watch=false
  ```

  Expected: all tests pass, 0 failures.

  Run (from repo root):

  ```bash
  npm run lint
  ```

  Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Manually verify in the running app**

  Run `npm start` from the repo root, trigger the "torrent already exists" modal (e.g. re-add a torrent already in the list) with the delete-file setting enabled, switch the app language to Hungarian, and confirm:
  - The footer renders all visible buttons on a single row at the default modal size.
  - Hovering the trash icon shows a tooltip with the delete-file label.
  - The modal is no longer wider than the default size.

- [ ] **Step 3: Remove the docs/superpowers folder**

  ```bash
  rm -rf docs/superpowers
  git add docs/superpowers
  git commit -m "#180: removed spec and plan"
  ```
