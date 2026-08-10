# Torrent Details – General Tab Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the General tab of the torrent details modal to match the "BitButler UI Refresh" design: cap Information to 2 columns, strip copy-to-clipboard/hover chrome and bold text, and turn the Options card's read-only pill chips into a real, clickable, mirrored two-column button grid.

**Architecture:** Pure Angular standalone-component change inside `packages/app/src/app/modals/torrent-details/general/` plus one new method on the sibling `TorrentDetailsActionsService` and two i18n string additions. No new components, no new services, no IPC/shared-package changes.

**Tech Stack:** Angular 20 (zoneless, signals), `@ng-bootstrap/ng-bootstrap` (`NgbTooltip`/popover), Bootstrap 5 grid utility classes (`row`/`col-N`), `@ngx-translate/core`, Vitest + Angular TestBed.

## Global Constraints

- Commit format: `#267: short description` (this work continues branch `267-claude-inspired-ui-refresh`).
- `npm run lint` must stay at zero warnings (`max-warnings=0`) — remove any import that becomes unused as you go.
- No bold text anywhere on this tab (`font-weight` must not exceed normal/400).
- No hover-only affordances and no copy-to-clipboard actions on this tab.
- Options buttons are real, focusable, clickable `<button>` elements — never `disabled`.
- Off state → `btn btn-link`; On state → `btn-success`. Both use `btn btn-sm btn-split`.
- Reuse existing translation keys wherever they already exist (see `public/i18n/us.json` under `components.modals.torrent-details.general`) — only add the one new key this plan calls for.
- Use `-` not `—` in any commit message or comment text you write.

---

## Task 1: Add `toggleForceStart()` to `TorrentDetailsActionsService`

The Options card needs a real toggle action for the Force Start option. Every other Options toggle (`auto_tmm`, `seq_dl`, `f_l_piece_prio`, `super_seeding`) already has a matching service method. Force Start currently only has a one-way `forceResume()` action (always sets `force_start = true`). This task adds a proper two-way toggle, mirroring `toggleAutoTmm()`.

**Files:**

- Modify: `packages/app/src/app/modals/torrent-details/torrent-details-actions.service.ts`
- Test: `packages/app/src/app/modals/torrent-details/torrent-details-actions.service.spec.ts`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:**

- Produces: `TorrentDetailsActionsService.toggleForceStart(): Promise<void>` — reads `torrent().data.force_start`, calls `qbService.torrents.setForceStart(serverId, [hash], !current)`, shows a danger toast (translation key `components.modals.torrent-details.general.toast.toggle-force-start-failed`) on failure, no toast on success. Task 3 wires an Options button to this method.

- [ ] **Step 1: Write the failing tests**

Open `packages/app/src/app/modals/torrent-details/torrent-details-actions.service.spec.ts`. Find the `describe('toggleSuperSeeding', ...)` block (it ends around line 389, just before `describe('saveFileChanges', ...)`). Insert this new `describe` block immediately after it, before `describe('saveFileChanges', ...)`:

```typescript
describe('toggleForceStart', () => {
  it('calls setForceStart with the inverted force_start value', async () => {
    // makeTorrent sets force_start: false, so enabling = true
    await service.toggleForceStart();
    expect(qbTorrents.setForceStart).toHaveBeenCalledWith('server-1', ['abc123'], true);
  });

  it('disables when force_start is currently true', async () => {
    mockDataService.torrent.set({
      data: makeTorrent({ force_start: true }),
      properties: {} as any,
    });
    await service.toggleForceStart();
    expect(qbTorrents.setForceStart).toHaveBeenCalledWith('server-1', ['abc123'], false);
  });

  it('shows a danger toast when toggling fails', async () => {
    qbTorrents.setForceStart.mockRejectedValueOnce(new Error('boom'));
    await service.toggleForceStart();
    expect(toastDanger).toHaveBeenCalledWith(
      'boom',
      'components.modals.torrent-details.general.toast.toggle-force-start-failed',
    );
  });
});
```

Note: `qbTorrents.setForceStart` is already mocked in this file's `beforeEach` (it backs the existing `forceResume` tests), so no new mock wiring is needed.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- torrent-details-actions.service.spec.ts`
Expected: FAIL — `service.toggleForceStart is not a function`.

- [ ] **Step 3: Implement `toggleForceStart()`**

In `packages/app/src/app/modals/torrent-details/torrent-details-actions.service.ts`, add this method immediately after `toggleSuperSeeding()` (which currently ends right before `deleteTorrent()`):

```typescript
  public async toggleForceStart(): Promise<void> {
    const current = this.dataService.torrent()!.data.force_start;
    try {
      await this.qbService.torrents.setForceStart(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
        !current,
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.toggle-force-start-failed',
        ),
      );
    }
  }

```

- [ ] **Step 4: Add the new toast translation key**

In `public/i18n/us.json`, find (inside `components.modals.torrent-details.general.toast`):

```json
            "toggle-auto-tmm-failed": "Failed to Toggle Auto TMM",
            "toggle-super-seeding-failed": "Failed to Toggle Super Seeding"
          },
```

Replace with:

```json
            "toggle-auto-tmm-failed": "Failed to Toggle Auto TMM",
            "toggle-super-seeding-failed": "Failed to Toggle Super Seeding",
            "toggle-force-start-failed": "Failed to Toggle Force Start"
          },
```

In `public/i18n/hu.json`, find the equivalent block:

```json
            "toggle-auto-tmm-failed": "Nem sikerült átváltani az Auto TMM-et",
            "toggle-super-seeding-failed": "Nem sikerült átváltani a super seedinget"
          },
```

Replace with:

```json
            "toggle-auto-tmm-failed": "Nem sikerült átváltani az Auto TMM-et",
            "toggle-super-seeding-failed": "Nem sikerült átváltani a super seedinget",
            "toggle-force-start-failed": "Nem sikerült átváltani a kényszerített indítást"
          },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- torrent-details-actions.service.spec.ts`
Expected: PASS (all `toggleForceStart` tests green, no regressions in the rest of the file).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/modals/torrent-details/torrent-details-actions.service.ts packages/app/src/app/modals/torrent-details/torrent-details-actions.service.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#267: add toggleForceStart action for torrent details"
```

---

## Task 2: Strip copy-to-clipboard, hover chrome, and bold text; cap Information to 2 columns

This task only touches the Details, Transfer, and Information cards (everything in the General tab _except_ the Options card, which is Task 3). It removes the per-row copy button and its hover-reveal behavior, removes the bold weight from row values, and narrows the Information card's row grid so it never shows 3 columns.

**Files:**

- Modify: `packages/app/src/app/modals/torrent-details/general/general.html`
- Modify: `packages/app/src/app/modals/torrent-details/general/general.ts`
- Modify: `packages/app/src/app/modals/torrent-details/general/general.scss`
- Test: `packages/app/src/app/modals/torrent-details/general/general.spec.ts`

**Interfaces:**

- Consumes: nothing from Task 1.
- Produces: nothing other tasks depend on — Task 3 edits the same files but a different section (the Options card), so there's no signature dependency between them.

- [ ] **Step 1: Write the failing tests**

Open `packages/app/src/app/modals/torrent-details/general/general.spec.ts`. Find the `describe('General tab restructure', ...)` block. Add these two new tests inside it (after the existing `'renders 18 stat rows...'` test, before the `'renders 5 toggle chips...'` test — that one is rewritten in Task 3, leave it as-is for now):

```typescript
it('does not render any copy-to-clipboard buttons', () => {
  expect(fixture.nativeElement.querySelector('.button-container')).toBeNull();
});

it('caps the Information card grid at 2 columns', () => {
  const infoHeader = Array.from(fixture.nativeElement.querySelectorAll('.bb-fieldset-title')).find(
    (el: any) => el.textContent?.includes('.labels.information'),
  ) as HTMLElement;
  const infoCard = infoHeader.closest('.bb-fieldset') as HTMLElement;
  expect(infoCard.querySelector('.col-xl-4')).toBeNull();
  expect(infoCard.querySelector('.col-lg-6')).not.toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- general.spec.ts`
Expected: FAIL — both new tests fail (`.button-container` still present; `.col-xl-4` still present).

- [ ] **Step 3: Remove the 9 copy-to-clipboard blocks from `general.html`**

Each block below is a `<div class="button-container">…</div>` guarded by an `@if`. Delete all 9 (do not delete the `@if`/value markup around them — only the `button-container` div itself). Match each by its unique `toClipboard(...)` call.

Remove (Name row):

```html
<div class="button-container">
  @if (torrent()!.data.name) {
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                  'components.modals.torrent-details.general.copy-to-clipboard' | translate
                "
    (click)="toClipboard('name', torrent()!.data.name)"
  >
    <fa-icon [icon]="icons['faCopy']" />
  </button>
  }
</div>
```

Remove (Save Path row):

```html
<div class="button-container">
  @if (torrent()!.data.save_path) {
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                  'components.modals.torrent-details.general.copy-to-clipboard' | translate
                "
    (click)="toClipboard('save-path', torrent()!.data.save_path)"
  >
    <fa-icon [icon]="icons['faCopy']" />
  </button>
  }
</div>
```

Remove (Remote Path row):

```html
<div class="button-container">
  @if (torrent()!.data.content_path) {
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                  'components.modals.torrent-details.general.copy-to-clipboard' | translate
                "
    (click)="toClipboard('remote-path', torrent()!.data.content_path)"
  >
    <fa-icon [icon]="icons['faCopy']" />
  </button>
  }
</div>
```

Remove (Local Path row — this one is nested inside `@if (localPath()) { ... }`, keep that outer block, only remove the inner button-container div):

```html
<div class="button-container">
  @if (torrent()!.data.save_path) {
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                    'components.modals.torrent-details.general.copy-to-clipboard' | translate
                  "
    (click)="toClipboard('local-path', torrent()!.data.save_path)"
  >
    <fa-icon [icon]="icons['faCopy']" />
  </button>
  }
</div>
```

Remove (Category row):

```html
<div class="button-container">
  @if (torrent()!.data.category) {
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                  'components.modals.torrent-details.general.copy-to-clipboard' | translate
                "
    (click)="toClipboard('category', torrent()!.data.category)"
  >
    <fa-icon [icon]="icons['faCopy']" />
  </button>
  }
</div>
```

Remove (Tags row):

```html
<div class="button-container">
  @if (torrent()!.data.tags) {
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                  'components.modals.torrent-details.general.copy-to-clipboard' | translate
                "
    (click)="toClipboard('tags', torrent()!.data.tags)"
  >
    <fa-icon [icon]="icons['faCopy']" />
  </button>
  }
</div>
```

Remove (Info Hash v1 row):

```html
<div class="button-container">
  @if (torrent()!.data.infohash_v1) {
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                  'components.modals.torrent-details.general.copy-to-clipboard' | translate
                "
    (click)="toClipboard('info-hash-v1', torrent()!.data.infohash_v1)"
  >
    <fa-icon [icon]="icons['faCopy']" />
  </button>
  }
</div>
```

Remove (Info Hash v2 row):

```html
<div class="button-container">
  @if (torrent()!.data.infohash_v2) {
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                  'components.modals.torrent-details.general.copy-to-clipboard' | translate
                "
    (click)="toClipboard('info-hash-v2', torrent()!.data.infohash_v2)"
  >
    <fa-icon [icon]="icons['faCopy']" />
  </button>
  }
</div>
```

Remove (Comment row):

```html
<div class="button-container">
  @if (torrent()!.properties.comment) {
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                  'components.modals.torrent-details.general.copy-to-clipboard' | translate
                "
    (click)="toClipboard('comment', torrent()!.properties.comment)"
  >
    <fa-icon [icon]="icons['faCopy']" />
  </button>
  }
</div>
```

- [ ] **Step 4: Cap the Information card at 2 columns**

Still in `general.html`, in the Information card, replace every occurrence (there are 6: Total Size, Pieces, Created By, Added On, Completed On, Created On) of:

```html
<div class="col-12 col-lg-6 col-xl-4 bb-section"></div>
```

with:

```html
<div class="col-12 col-lg-6 bb-section"></div>
```

- [ ] **Step 5: Remove `toClipboard()` and its now-unused imports from `general.ts`**

In `packages/app/src/app/modals/torrent-details/general/general.ts`, replace:

```typescript
import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { faCheck, faCopy, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbCollapse, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
```

with:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbCollapse, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
```

Then replace:

```typescript
export class General implements TorrentDetailTabComponent {
  private readonly dataService = inject(TorrentDetailsDataService);
  private readonly clipboard = inject(Clipboard);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public icons: Record<string, IconDefinition> = { faCopy, faCheck, faXmark };
```

with:

```typescript
export class General implements TorrentDetailTabComponent {
  private readonly dataService = inject(TorrentDetailsDataService);

  public icons: Record<string, IconDefinition> = { faCheck, faXmark };
```

Then remove the `toClipboard` method entirely:

```typescript
  public toClipboard(fieldKey: string, value: string): void {
    const field = this.translateService.instant(
      `components.modals.torrent-details.general.${fieldKey}`,
    );
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.copied-to-clipboard',
        { field },
      ),
    );
    this.clipboard.copy(value);
  }

```

Finally, remove the now-unused `ToastService` import line:

```typescript
import { ToastService } from '../../../services/toast.service';
```

- [ ] **Step 6: Remove hover chrome, the button-container CSS, and the bold row-value weight in `general.scss`**

In `packages/app/src/app/modals/torrent-details/general/general.scss`, replace:

```scss
span.section-value {
  font-weight: 600;

  small {
    display: block;
    font-weight: 400;
    color: var(--bs-secondary-color);
  }
}

div.bb-section {
  display: grid;
  grid-template-columns: max-content 1fr auto;
  align-items: center;
  column-gap: 16px;
  padding: 10px 4px;
  position: relative;
  border-bottom: 1px solid var(--bs-border-color);
  transition: background-color 0.15s ease-in-out;

  &:last-child {
    border-bottom: 0;
  }

  &:hover,
  &:focus-within {
    background-color: var(--bb-hover-list-item-bg);

    > div.button-container {
      opacity: 1;
      visibility: visible;
    }
  }

  > div.button-container {
    grid-column: 3;
    grid-row: 1 / -1;
    display: flex;
    align-items: center;
    flex-shrink: 0;

    opacity: 0;
    visibility: hidden;

    transition:
      opacity 0.15s ease-in-out,
      visibility 0.15s ease-in-out;
  }

  > span.section-header {
    grid-column: 1;
    grid-row: 1 / -1;
    flex-shrink: 0;
  }

  > span.section-value {
    grid-column: 2;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
```

with:

```scss
span.section-value {
  font-weight: 400;

  small {
    display: block;
    font-weight: 400;
    color: var(--bs-secondary-color);
  }
}

div.bb-section {
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  column-gap: 16px;
  padding: 10px 4px;
  position: relative;
  border-bottom: 1px solid var(--bs-border-color);

  &:last-child {
    border-bottom: 0;
  }

  > span.section-header {
    grid-column: 1;
    grid-row: 1 / -1;
    flex-shrink: 0;
  }

  > span.section-value {
    grid-column: 2;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- general.spec.ts`
Expected: PASS (all tests including the two new ones; the pre-existing `'renders 5 toggle chips...'` test still passes untouched since Task 3 hasn't run yet).

- [ ] **Step 8: Lint check**

Run: `npm run lint`
Expected: 0 warnings, 0 errors (confirms no unused imports were left behind).

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/modals/torrent-details/general/general.html packages/app/src/app/modals/torrent-details/general/general.ts packages/app/src/app/modals/torrent-details/general/general.scss packages/app/src/app/modals/torrent-details/general/general.spec.ts
git commit -m "#267: remove copy-to-clipboard/hover chrome and cap Information to 2 columns"
```

---

## Task 3: Turn the Options card into a clickable mirrored split-button grid

Replace the read-only `.bb-toggle-grid` pill chips with real buttons that both show and set each option's state, laid out in two mirrored columns (icon + popover clustered toward the row's center). Then remove the now-redundant duplicate toggle entries from the footer's Transfer and Maintenance dropdowns.

**Files:**

- Modify: `packages/app/src/app/modals/torrent-details/general/general.html`
- Modify: `packages/app/src/app/modals/torrent-details/general/general.ts`
- Modify: `packages/app/src/app/modals/torrent-details/general/general.scss`
- Modify: `packages/app/src/app/modals/torrent-details/torrent-details.html`
- Test: `packages/app/src/app/modals/torrent-details/general/general.spec.ts`

**Interfaces:**

- Consumes: `TorrentDetailsActionsService.toggleForceStart()` from Task 1, plus the existing `toggleAutoTmm()`, `toggleSequentialDownload()`, `toggleFirstLastPiecePrio()`, `toggleSuperSeeding()`.
- Produces: nothing further tasks depend on (this is the last task in the plan).

- [ ] **Step 1: Rewrite the failing test for the Options card**

Open `packages/app/src/app/modals/torrent-details/general/general.spec.ts`. Replace the existing test:

```typescript
it('renders 5 toggle chips inside the Options card, reflecting on/off state', () => {
  const toggles = Array.from(fixture.nativeElement.querySelectorAll('.bb-toggle')) as HTMLElement[];
  expect(toggles.length).toBe(5);

  const on = toggles.filter((t) => t.classList.contains('bb-toggle--on'));
  const off = toggles.filter((t) => !t.classList.contains('bb-toggle--on'));
  expect(on.length).toBe(2); // auto_tmm, seq_dl
  expect(off.length).toBe(3); // force_start, f_l_piece_prio, super_seeding
});
```

with:

```typescript
it('renders 5 clickable Options buttons reflecting on/off state', () => {
  const buttons = Array.from(
    fixture.nativeElement.querySelectorAll('.bb-options-grid button'),
  ) as HTMLButtonElement[];
  expect(buttons.length).toBe(5);

  const on = buttons.filter((b) => b.classList.contains('btn-success'));
  const off = buttons.filter((b) => b.classList.contains('btn-link'));
  expect(on.length).toBe(2); // auto_tmm, seq_dl
  expect(off.length).toBe(3); // force_start, f_l_piece_prio, super_seeding
  expect(buttons.every((b) => !b.disabled)).toBe(true);
});

it('clicking an Options button calls the matching action-service toggle method', () => {
  const buttons = Array.from(
    fixture.nativeElement.querySelectorAll('.bb-options-grid button'),
  ) as HTMLButtonElement[];

  buttons.find((b) => b.textContent?.includes('force-start'))?.click();
  expect(mockActionsService.toggleForceStart).toHaveBeenCalled();

  buttons.find((b) => b.textContent?.includes('super-seeding'))?.click();
  expect(mockActionsService.toggleSuperSeeding).toHaveBeenCalled();
});
```

Now add the mock `TorrentDetailsActionsService` this test needs. Near the top of the file, find:

```typescript
describe('General', () => {
  let component: General;
  let fixture: ComponentFixture<General>;
  let mockDataService: {
    torrent: ReturnType<typeof signal<MergedTorrent | null>>;
    localPath: ReturnType<typeof signal<string | null>>;
    errorLog: ReturnType<typeof signal<QbLogEntry | null>>;
  };

  beforeEach(async () => {
    mockDataService = {
      torrent: signal(null),
      localPath: signal(null),
      errorLog: signal(null),
    };

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: TorrentDetailsDataService, useValue: mockDataService },
        { provide: Clipboard, useValue: { copy: vi.fn() } },
        { provide: ToastService, useValue: { info: vi.fn(), danger: vi.fn() } },
        provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
      ],
    }).compileComponents();
```

Replace with:

```typescript
describe('General', () => {
  let component: General;
  let fixture: ComponentFixture<General>;
  let mockDataService: {
    torrent: ReturnType<typeof signal<MergedTorrent | null>>;
    localPath: ReturnType<typeof signal<string | null>>;
    errorLog: ReturnType<typeof signal<QbLogEntry | null>>;
  };
  let mockActionsService: {
    toggleAutoTmm: ReturnType<typeof vi.fn>;
    toggleForceStart: ReturnType<typeof vi.fn>;
    toggleSequentialDownload: ReturnType<typeof vi.fn>;
    toggleFirstLastPiecePrio: ReturnType<typeof vi.fn>;
    toggleSuperSeeding: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockDataService = {
      torrent: signal(null),
      localPath: signal(null),
      errorLog: signal(null),
    };
    mockActionsService = {
      toggleAutoTmm: vi.fn(),
      toggleForceStart: vi.fn(),
      toggleSequentialDownload: vi.fn(),
      toggleFirstLastPiecePrio: vi.fn(),
      toggleSuperSeeding: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: TorrentDetailsDataService, useValue: mockDataService },
        { provide: TorrentDetailsActionsService, useValue: mockActionsService },
        provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
      ],
    }).compileComponents();
```

Note this also drops the now-unused `Clipboard` and `ToastService` test providers (the component no longer injects them after Task 2). Update the top-of-file imports accordingly — replace:

```typescript
import { Clipboard } from '@angular/cdk/clipboard';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeagoIntl, provideTimeago } from 'ngx-timeago';
import {
  QbLogEntry,
  QbLogMessageType,
  QbTorrentProperties,
} from '../../../models/qbittorrent.model';
import { Torrent } from '../../../models/torrent.model';
import { ToastService } from '../../../services/toast.service';
import { MergedTorrent, TorrentDetailsDataService } from '../torrent-details-data.service';
import { General } from './general';
```

with:

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeagoIntl, provideTimeago } from 'ngx-timeago';
import {
  QbLogEntry,
  QbLogMessageType,
  QbTorrentProperties,
} from '../../../models/qbittorrent.model';
import { Torrent } from '../../../models/torrent.model';
import { TorrentDetailsActionsService } from '../torrent-details-actions.service';
import { MergedTorrent, TorrentDetailsDataService } from '../torrent-details-data.service';
import { General } from './general';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- general.spec.ts`
Expected: FAIL — `.bb-options-grid` doesn't exist yet, and `TorrentDetailsActionsService` isn't injected by `General` yet (DI error).

- [ ] **Step 3: Replace the Options card markup in `general.html`**

Find the entire Options `bb-fieldset` block — it starts at:

```html
<div class="bb-fieldset">
  <div class="bb-fieldset-title">
    {{ 'components.modals.torrent-details.general.labels.options' | translate }}
  </div>
  <div class="bb-toggle-grid"></div>
</div>
```

and ends at the matching closing tags right before the Transfer card's `bb-fieldset` begins (i.e. everything from that opening `<div class="bb-fieldset">` through its closing `</div>`, covering all 5 `<div class="bb-toggle" ...>` blocks for Auto TMM, Force Start, Sequential Download, First/Last Piece Priority, and Super Seeding). Replace that entire block with:

```html
<div class="bb-fieldset">
  <div class="bb-fieldset-title">
    {{ 'components.modals.torrent-details.general.labels.options' | translate }}
  </div>
  <div class="row gy-2 align-items-center bb-options-grid">
    <div class="col-5">
      <button
        type="button"
        class="btn btn-sm btn-split w-100"
        [class.btn-link]="!torrent()!.data.auto_tmm"
        [class.btn-success]="torrent()!.data.auto_tmm"
        [attr.aria-pressed]="torrent()!.data.auto_tmm ? 'true' : 'false'"
        (click)="actionsService.toggleAutoTmm()"
      >
        <bb-btn-content
          [icon]="torrent()!.data.auto_tmm ? icons['faCheck'] : icons['faXmark']"
          [text]="'components.modals.torrent-details.general.auto-tmm' | translate"
          position="end"
        ></bb-btn-content>
      </button>
    </div>
    <div class="col-1 d-flex justify-content-end">
      <bb-popover
        placement="right"
        [subject]="
              'components.modals.torrent-details.general.popover.auto-tmm.title' | translate
            "
        [description]="
              'components.modals.torrent-details.general.popover.auto-tmm.description' | translate
            "
      ></bb-popover>
    </div>
    <div class="col-1 d-flex justify-content-start">
      <bb-popover
        placement="left"
        [subject]="
              'components.modals.torrent-details.general.popover.force-start.title' | translate
            "
        [description]="
              'components.modals.torrent-details.general.popover.force-start.description'
                | translate
            "
      ></bb-popover>
    </div>
    <div class="col-5">
      <button
        type="button"
        class="btn btn-sm btn-split w-100"
        [class.btn-link]="!torrent()!.data.force_start"
        [class.btn-success]="torrent()!.data.force_start"
        [attr.aria-pressed]="torrent()!.data.force_start ? 'true' : 'false'"
        (click)="actionsService.toggleForceStart()"
      >
        <bb-btn-content
          [icon]="torrent()!.data.force_start ? icons['faCheck'] : icons['faXmark']"
          [text]="'components.modals.torrent-details.general.force-start' | translate"
          position="start"
        ></bb-btn-content>
      </button>
    </div>

    <div class="col-5">
      <button
        type="button"
        class="btn btn-sm btn-split w-100"
        [class.btn-link]="!torrent()!.data.seq_dl"
        [class.btn-success]="torrent()!.data.seq_dl"
        [attr.aria-pressed]="torrent()!.data.seq_dl ? 'true' : 'false'"
        (click)="actionsService.toggleSequentialDownload()"
      >
        <bb-btn-content
          [icon]="torrent()!.data.seq_dl ? icons['faCheck'] : icons['faXmark']"
          [text]="'components.modals.torrent-details.general.sequential-download' | translate"
          position="end"
        ></bb-btn-content>
      </button>
    </div>
    <div class="col-1 d-flex justify-content-end">
      <bb-popover
        placement="right"
        [subject]="
              'components.modals.torrent-details.general.popover.sequential-download.title'
                | translate
            "
        [description]="
              'components.modals.torrent-details.general.popover.sequential-download.description'
                | translate
            "
      ></bb-popover>
    </div>
    <div class="col-1 d-flex justify-content-start">
      <bb-popover
        placement="left"
        [subject]="
              'components.modals.torrent-details.general.popover.first-last-piece-prio.title'
                | translate
            "
        [description]="
              'components.modals.torrent-details.general.popover.first-last-piece-prio.description'
                | translate
            "
      ></bb-popover>
    </div>
    <div class="col-5">
      <button
        type="button"
        class="btn btn-sm btn-split w-100"
        [class.btn-link]="!torrent()!.data.f_l_piece_prio"
        [class.btn-success]="torrent()!.data.f_l_piece_prio"
        [attr.aria-pressed]="torrent()!.data.f_l_piece_prio ? 'true' : 'false'"
        (click)="actionsService.toggleFirstLastPiecePrio()"
      >
        <bb-btn-content
          [icon]="torrent()!.data.f_l_piece_prio ? icons['faCheck'] : icons['faXmark']"
          [text]="
                'components.modals.torrent-details.general.first-last-piece-prio' | translate
              "
          position="start"
        ></bb-btn-content>
      </button>
    </div>

    <div class="col-5">
      <button
        type="button"
        class="btn btn-sm btn-split w-100"
        [class.btn-link]="!torrent()!.data.super_seeding"
        [class.btn-success]="torrent()!.data.super_seeding"
        [attr.aria-pressed]="torrent()!.data.super_seeding ? 'true' : 'false'"
        (click)="actionsService.toggleSuperSeeding()"
      >
        <bb-btn-content
          [icon]="torrent()!.data.super_seeding ? icons['faCheck'] : icons['faXmark']"
          [text]="'components.modals.torrent-details.general.super-seeding' | translate"
          position="end"
        ></bb-btn-content>
      </button>
    </div>
    <div class="col-1 d-flex justify-content-end">
      <bb-popover
        placement="right"
        [subject]="
              'components.modals.torrent-details.general.popover.super-seeding.title' | translate
            "
        [description]="
              'components.modals.torrent-details.general.popover.super-seeding.description'
                | translate
            "
      ></bb-popover>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Wire up `general.ts` — inject the actions service, import `BbBtnContent`, drop `FontAwesomeModule`**

`general.html` no longer contains any direct `<fa-icon>` tag after this change (the Options card's icons now render through `<bb-btn-content>`, which imports `FontAwesomeModule` itself). Replace the imports block in `packages/app/src/app/modals/torrent-details/general/general.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbCollapse, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbProgressCompact } from '../../../components/bb-progress-compact/bb-progress-compact';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { QbLogEntry } from '../../../models/qbittorrent.model';
import { FileSizePerSecPipe } from '../../../pipes/filesize-per-sec-pipe';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../../../pipes/humanize-duration-pipe';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { RatioLimitPipe } from '../../../pipes/ratio-limit-pipe';
import { RatioPipe } from '../../../pipes/ratio-pipe';
import { SpeedLimitPipe } from '../../../pipes/speed-limit-pipe';
import { TimeLimitPipe } from '../../../pipes/time-limit-pipe';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';

@Component({
  selector: 'app-general',
  imports: [
    BbSpinner,
    LocalTimestampPipe,
    TimeagoPipe,
    FilesizePipe,
    FileSizePerSecPipe,
    HumanizeDurationPipe,
    SpeedLimitPipe,
    BbProgressCompact,
    FontAwesomeModule,
    NgbCollapse,
    NgbTooltip,
    RatioLimitPipe,
    RatioPipe,
    TimeLimitPipe,
    BbPopover,
    TranslatePipe,
    TooltipOverflow,
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class General implements TorrentDetailTabComponent {
  private readonly dataService = inject(TorrentDetailsDataService);

  public icons: Record<string, IconDefinition> = { faCheck, faXmark };
```

with:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IconDefinition } from '@fortawesome/angular-fontawesome';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbCollapse, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbProgressCompact } from '../../../components/bb-progress-compact/bb-progress-compact';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { QbLogEntry } from '../../../models/qbittorrent.model';
import { FileSizePerSecPipe } from '../../../pipes/filesize-per-sec-pipe';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../../../pipes/humanize-duration-pipe';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { RatioLimitPipe } from '../../../pipes/ratio-limit-pipe';
import { RatioPipe } from '../../../pipes/ratio-pipe';
import { SpeedLimitPipe } from '../../../pipes/speed-limit-pipe';
import { TimeLimitPipe } from '../../../pipes/time-limit-pipe';
import { TorrentDetailsActionsService } from '../torrent-details-actions.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';

@Component({
  selector: 'app-general',
  imports: [
    BbSpinner,
    LocalTimestampPipe,
    TimeagoPipe,
    FilesizePipe,
    FileSizePerSecPipe,
    HumanizeDurationPipe,
    SpeedLimitPipe,
    BbProgressCompact,
    NgbCollapse,
    NgbTooltip,
    RatioLimitPipe,
    RatioPipe,
    TimeLimitPipe,
    BbPopover,
    BbBtnContent,
    TranslatePipe,
    TooltipOverflow,
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class General implements TorrentDetailTabComponent {
  private readonly dataService = inject(TorrentDetailsDataService);
  public readonly actionsService = inject(TorrentDetailsActionsService);

  public icons: Record<string, IconDefinition> = { faCheck, faXmark };
```

- [ ] **Step 5: Remove the dead `.bb-toggle-grid`/`.bb-toggle` styles from `general.scss`**

In `packages/app/src/app/modals/torrent-details/general/general.scss`, delete this block entirely (it sat right after the `@media (max-width: 575.98px)` block and right before `div.bb-section.bb-section--danger`):

```scss
.bb-toggle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.bb-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bb-control-radius);
  font-size: 0.85rem;
  color: var(--bs-secondary-color);
}

.bb-toggle__icon {
  flex-shrink: 0;
  color: var(--bs-secondary-color);
}

.bb-toggle--on {
  color: var(--bs-body-color);

  .bb-toggle__icon {
    color: var(--bs-success);
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- general.spec.ts`
Expected: PASS (all tests, including the two Options tests from Step 1).

- [ ] **Step 7: Remove the now-redundant toggle entries from the footer dropdowns**

Open `packages/app/src/app/modals/torrent-details/torrent-details.html`. In the **Transfer** dropdown, replace:

```html
      <button ngbDropdownItem type="button" (click)="actionsService.openShareLimitsModal()">
        <span class="bb-dropdown-icon" aria-hidden="true"
          ><fa-icon [icon]="icon.faShare"></fa-icon
        ></span>
        {{ 'components.modals.torrent-details.general.edit-share-limits' | translate }}
      </button>
      <div class="dropdown-divider"></div>
      <button ngbDropdownItem type="button" (click)="actionsService.toggleSuperSeeding()">
        <span class="bb-dropdown-icon" aria-hidden="true">
          @if (dataService.torrent()?.data?.super_seeding) {
            <fa-icon [icon]="icon.faCheck"></fa-icon>
          }
        </span>
        {{ 'components.modals.torrent-details.general.footer.super-seeding' | translate }}
      </button>
      <button ngbDropdownItem type="button" (click)="actionsService.toggleSequentialDownload()">
        <span class="bb-dropdown-icon" aria-hidden="true">
          @if (dataService.torrent()?.data?.seq_dl) {
            <fa-icon [icon]="icon.faCheck"></fa-icon>
          }
        </span>
        {{ 'components.modals.torrent-details.general.footer.sequential-download' | translate }}
      </button>
      <button ngbDropdownItem type="button" (click)="actionsService.toggleFirstLastPiecePrio()">
        <span class="bb-dropdown-icon" aria-hidden="true">
          @if (dataService.torrent()?.data?.f_l_piece_prio) {
            <fa-icon [icon]="icon.faCheck"></fa-icon>
          }
        </span>
        {{ 'components.modals.torrent-details.general.footer.first-last-piece-prio' | translate }}
      </button>
    </div>
  </div>

  <div ngbDropdown container="body" placement="top-start">
    <button type="button" class="btn btn-secondary btn-sm btn-split" ngbDropdownToggle>
      <bb-btn-content
        [icon]="icon.faRotate"
```

with:

```html
      <button ngbDropdownItem type="button" (click)="actionsService.openShareLimitsModal()">
        <span class="bb-dropdown-icon" aria-hidden="true"
          ><fa-icon [icon]="icon.faShare"></fa-icon
        ></span>
        {{ 'components.modals.torrent-details.general.edit-share-limits' | translate }}
      </button>
    </div>
  </div>

  <div ngbDropdown container="body" placement="top-start">
    <button type="button" class="btn btn-secondary btn-sm btn-split" ngbDropdownToggle>
      <bb-btn-content
        [icon]="icon.faRotate"
```

This block runs from the last non-toggle item of the **Transfer** dropdown (`openShareLimitsModal`, using `icon.faShare`) through the divider and all 3 toggle items (`toggleSuperSeeding`, `toggleSequentialDownload`, `toggleFirstLastPiecePrio`), closing that dropdown, and stopping right at the start of the **Maintenance** dropdown (identified by `icon.faRotate` and the `footer.maintenance` label) so its opening markup is untouched.

In the **Maintenance** dropdown, replace:

```html
      <button ngbDropdownItem type="button" (click)="actionsService.forceReannounce()">
        <span class="bb-dropdown-icon" aria-hidden="true"
          ><fa-icon [icon]="icon.faBullhorn"></fa-icon
        ></span>
        {{ 'components.modals.torrent-details.general.force-reannounce' | translate }}
      </button>
      <div class="dropdown-divider"></div>
      <button ngbDropdownItem type="button" (click)="actionsService.toggleAutoTmm()">
        <span class="bb-dropdown-icon" aria-hidden="true">
          @if (dataService.torrent()?.data?.auto_tmm) {
            <fa-icon [icon]="icon.faCheck"></fa-icon>
          }
        </span>
        {{ 'components.modals.torrent-details.general.footer.auto-tmm' | translate }}
      </button>
    </div>
  </div>

  <button
    type="button"
    class="btn btn-link btn-sm btn-split"
    (click)="activeModal.dismiss()"
```

with:

```html
      <button ngbDropdownItem type="button" (click)="actionsService.forceReannounce()">
        <span class="bb-dropdown-icon" aria-hidden="true"
          ><fa-icon [icon]="icon.faBullhorn"></fa-icon
        ></span>
        {{ 'components.modals.torrent-details.general.force-reannounce' | translate }}
      </button>
    </div>
  </div>

  <button
    type="button"
    class="btn btn-link btn-sm btn-split"
    (click)="activeModal.dismiss()"
```

- [ ] **Step 8: Run the full torrent-details test suite to verify nothing broke**

Run: `npm test --workspace=@bitbutler/app -- torrent-details.spec.ts general.spec.ts torrent-details-actions.service.spec.ts`
Expected: PASS. `torrent-details.spec.ts` has no existing assertions on `toggleSuperSeeding`, `toggleSequentialDownload`, `toggleFirstLastPiecePrio`, or `toggleAutoTmm` (its `mockActionsService` doesn't even define those methods), so removing the dropdown items needs no test changes there.

- [ ] **Step 9: Lint check**

Run: `npm run lint`
Expected: 0 warnings, 0 errors.

- [ ] **Step 10: Manual verification**

Run: `npm start`, open a torrent's details modal, General tab:

- Confirm the Options card shows 5 buttons in the mirrored 2-column layout, popovers between the columns opening away from center.
- Click each button and confirm the color flips link ↔ success and the underlying qBittorrent state changes (check the Transfer/Maintenance dropdowns no longer show those 4 toggle items).
- Confirm the Information card never shows more than 2 columns, even at the widest window size.
- Confirm no row shows a copy button or a hover highlight, and no text on the tab reads as bold.

- [ ] **Step 11: Commit**

```bash
git add packages/app/src/app/modals/torrent-details/general/general.html packages/app/src/app/modals/torrent-details/general/general.ts packages/app/src/app/modals/torrent-details/general/general.scss packages/app/src/app/modals/torrent-details/general/general.spec.ts packages/app/src/app/modals/torrent-details/torrent-details.html
git commit -m "#267: make Options card a clickable split-button grid and trim duplicate footer toggles"
```

---

## Task 4: Remove the design spec/plan docs and open the PR prep

Per this repo's convention, `docs/superpowers/specs` and `docs/superpowers/plans` must not be merged to main.

**Files:**

- Delete: `docs/superpowers/specs/2026-08-10-torrent-details-general-tab-refresh-design.md`
- Delete: `docs/superpowers/plans/2026-08-10-torrent-details-general-tab-refresh.md`

- [ ] **Step 1: Remove the docs folder contents for this feature**

```bash
git rm docs/superpowers/specs/2026-08-10-torrent-details-general-tab-refresh-design.md docs/superpowers/plans/2026-08-10-torrent-details-general-tab-refresh.md
```

If `docs/superpowers/specs` and `docs/superpowers/plans` are now empty, also remove the (now-empty) `docs/superpowers` tree from git's perspective — `git rm` already handles this automatically since git doesn't track empty directories.

- [ ] **Step 2: Commit**

```bash
git commit -m "#267: removed spec and plan"
```

This must be the last commit before opening the PR (do not merge with the docs folder still present, per `CLAUDE.md`).
