# Transfer Rate Limit Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a reusable `TransferRateLimit` ControlValueAccessor, update the modal to wrap it, replace inline inputs in `add-torrent`, merge context menu items, and standardise the `share-limit` layout to `col-5` + `col-1` popover with units in labels.

**Architecture:** Mirrors the established `share-limit` ↔ `limit-torrent-share` pattern. A new standalone `TransferRateLimit` component owns the form UI and ControlValueAccessor contract; the modal and `add-torrent` delegate all rendering to it. The command bus loses the `direction` concept entirely.

**Tech Stack:** Angular 20 (zoneless, signals), Reactive Forms, ngx-translate, ng-bootstrap modals, FontAwesome icons.

---

## File Map

| Action | Path                                                                     |
| ------ | ------------------------------------------------------------------------ |
| Create | `src/app/components/transfer-rate-limit/transfer-rate-limit.ts`          |
| Create | `src/app/components/transfer-rate-limit/transfer-rate-limit.html`        |
| Create | `src/app/components/transfer-rate-limit/transfer-rate-limit.scss`        |
| Create | `src/app/components/transfer-rate-limit/transfer-rate-limit.spec.ts`     |
| Modify | `src/app/models/add-torrent.model.ts`                                    |
| Modify | `src/app/models/command.model.ts`                                        |
| Modify | `src/app/components/share-limit/share-limit.html`                        |
| Modify | `src/app/components/modals/limit-transfer-rate/limit-transfer-rate.ts`   |
| Modify | `src/app/components/modals/limit-transfer-rate/limit-transfer-rate.html` |
| Modify | `src/app/components/add-torrent/add-torrent.ts`                          |
| Modify | `src/app/components/add-torrent/add-torrent.html`                        |
| Modify | `src/app/services/ui-command-handler.service.ts`                         |
| Modify | `src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`      |
| Modify | `public/i18n/us.json`                                                    |
| Modify | `public/i18n/hu.json`                                                    |

---

## Task 1: Update command model

**Files:**

- Modify: `src/app/models/command.model.ts`

- [ ] **Step 1: Open the file and locate the relevant lines**

Read `src/app/models/command.model.ts`. You will find:

```typescript
export type LimitDirectionType = 'ul' | 'dl';
// ...
| { type: 'UI_LIMIT_TRANSFER'; direction: LimitDirectionType; target: LimitTargetType }
```

- [ ] **Step 2: Remove `LimitDirectionType` and update the command**

Replace the entire `LimitDirectionType` export and update the command union member:

```typescript
// Remove this line entirely:
export type LimitDirectionType = 'ul' | 'dl';

// Change this union member:
// BEFORE:
| { type: 'UI_LIMIT_TRANSFER'; direction: LimitDirectionType; target: LimitTargetType }
// AFTER:
| { type: 'UI_LIMIT_TRANSFER'; target: LimitTargetType }
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npm run lint 2>&1 | head -40
```

Expected: errors only about `direction` usages in `grid-context-menu.service.ts` and `ui-command-handler.service.ts` — those are fixed in later tasks. Zero errors from `command.model.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add src/app/models/command.model.ts
git commit -m "#45: Remove direction from UI_LIMIT_TRANSFER command"
```

---

## Task 2: Update translation files

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

### us.json changes

- [ ] **Step 1: Add the new `transfer-rate-limit` component section**

In `public/i18n/us.json`, find the `"components"` → `"share-limit"` key. Add a new sibling key `"transfer-rate-limit"` next to it:

```json
"transfer-rate-limit": {
  "upload-limit": "Upload Limit (KiB/s)",
  "download-limit": "Download Limit (KiB/s)",
  "popover": {
    "upload-limit": {
      "title": "Upload Limit",
      "description": "Maximum upload speed in KiB/s. Enter 0 for unlimited."
    },
    "download-limit": {
      "title": "Download Limit",
      "description": "Maximum download speed in KiB/s. Enter 0 for unlimited."
    }
  }
}
```

- [ ] **Step 2: Update the `share-limit` component keys**

In `public/i18n/us.json`, under `"components"` → `"share-limit"`:

- Remove the `"time-unit"` key (`"time-unit": "min"`)
- Update `"seeding-time-limit"` value: `"Seeding Time Limit"` → `"Seeding Time Limit (min)"`
- Update `"inactive-seeding-time-limit"` value: `"Inactive Seeding Time Limit"` → `"Inactive Seeding Time Limit (min)"`

- [ ] **Step 3: Update the `limit-transfer-rate` modal keys**

In `public/i18n/us.json`, under `"components"` → `"modals"` → `"limit-transfer-rate"`, replace the entire object:

```json
"limit-transfer-rate": {
  "title": "Limit Transfer Rate",
  "global": "Global Transfer Limit"
}
```

(Removes: `title-upload`, `title-download`, `limit-upload`, `limit-download`, `clear-limit`)

- [ ] **Step 4: Update context menu item keys**

In `public/i18n/us.json`, under `"pages"` → `"main"` → `"grid"` → `"context-menu"` → `"item"`:

- Remove: `"limit-upload-rate": "Limit upload rate"`
- Remove: `"limit-download-rate": "Limit download rate"`
- Add: `"limit-transfer-rate": "Limit Transfer Rate"`

- [ ] **Step 5: Remove stale `add-torrent` keys**

In `public/i18n/us.json`, under `"components"` → `"add-torrent"` → `"add-form"`:

- Remove: `"up-limit": "Upload Limit"`
- Remove: `"down-limit": "Download Limit"`

### hu.json changes

- [ ] **Step 6: Add the new `transfer-rate-limit` component section to hu.json**

In `public/i18n/hu.json`, add next to the `"share-limit"` section:

```json
"transfer-rate-limit": {
  "upload-limit": "Feltöltési korlát (KiB/s)",
  "download-limit": "Letöltési korlát (KiB/s)",
  "popover": {
    "upload-limit": {
      "title": "Feltöltési korlát",
      "description": "Maximális feltöltési sebesség KiB/s-ban. A 0 korlátlan sebességet jelent."
    },
    "download-limit": {
      "title": "Letöltési korlát",
      "description": "Maximális letöltési sebesség KiB/s-ban. A 0 korlátlan sebességet jelent."
    }
  }
}
```

- [ ] **Step 7: Update `share-limit` keys in hu.json**

Under `"components"` → `"share-limit"`:

- Remove: `"time-unit": "perc"`
- Update `"seeding-time-limit"`: `"Seedelési időkorlát"` → `"Seedelési időkorlát (perc)"`
- Update `"inactive-seeding-time-limit"`: `"Inaktív seedelési időkorlát"` → `"Inaktív seedelési időkorlát (perc)"`

- [ ] **Step 8: Update `limit-transfer-rate` modal keys in hu.json**

Under `"components"` → `"modals"` → `"limit-transfer-rate"`, replace:

```json
"limit-transfer-rate": {
  "title": "Átviteli sebesség korlátozása",
  "global": "Globális átviteli korlát"
}
```

- [ ] **Step 9: Update context menu item keys in hu.json**

Under `"pages"` → `"main"` → `"grid"` → `"context-menu"` → `"item"`:

- Remove: `"limit-upload-rate": "Feltöltési sebesség korlátozása"`
- Remove: `"limit-download-rate": "Letöltési sebesség korlátozása"`
- Add: `"limit-transfer-rate": "Átviteli sebesség korlátozása"`

- [ ] **Step 10: Remove stale `add-torrent` keys in hu.json**

Under `"components"` → `"add-torrent"` → `"add-form"`:

- Remove: `"up-limit": "Feltöltési korlát"`
- Remove: `"down-limit": "Letöltési korlát"`

- [ ] **Step 11: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#45: Update translation keys for transfer rate limit refactor"
```

---

## Task 3: Update share-limit layout

**Files:**

- Modify: `src/app/components/share-limit/share-limit.html`

- [ ] **Step 1: Replace the template**

Replace the entire content of `src/app/components/share-limit/share-limit.html` with:

```html
<div [formGroup]="form" class="container-fluid px-0">
  <div class="row">
    <div class="col-5">
      <div class="form-floating">
        <input
          type="number"
          step="0.1"
          class="form-control"
          id="ratioLimit"
          [placeholder]="'components.share-limit.ratio-limit' | translate"
          formControlName="ratioLimit"
          min="0"
        />
        <label for="ratioLimit">{{ 'components.share-limit.ratio-limit' | translate }}</label>
      </div>
    </div>

    <div class="col-1 d-flex align-items-center">
      <bb-popover
        class="mt-2"
        [subject]="'components.share-limit.popover.ratio-limit.title' | translate"
        [description]="'components.share-limit.popover.ratio-limit.description' | translate"
        placement="left"
      ></bb-popover>
    </div>

    <div class="col-12 mb-3">
      <div class="form-text mt-1 ms-2">{{ form.controls.ratioLimit.value ?? -1 | ratioLimit }}</div>
    </div>

    <div class="col-5">
      <div class="form-floating">
        <input
          type="number"
          class="form-control"
          id="seedingTimeLimit"
          [placeholder]="'components.share-limit.seeding-time-limit' | translate"
          formControlName="seedingTimeLimit"
          min="0"
        />
        <label for="seedingTimeLimit"
          >{{ 'components.share-limit.seeding-time-limit' | translate }}</label
        >
      </div>
    </div>

    <div class="col-1 d-flex align-items-center">
      <bb-popover
        class="mt-2"
        [subject]="'components.share-limit.popover.seeding-time-limit.title' | translate"
        [description]="'components.share-limit.popover.seeding-time-limit.description' | translate"
        placement="left"
      ></bb-popover>
    </div>

    <div class="col-12 mb-3">
      <div class="form-text mt-1 ms-2">
        {{ form.controls.seedingTimeLimit.value ?? -1 | timeLimit }}
      </div>
    </div>

    @if (!hideInactive) {
    <div class="col-5">
      <div class="form-floating">
        <input
          type="number"
          class="form-control"
          id="inactiveSeedingTimeLimit"
          [placeholder]="'components.share-limit.inactive-seeding-time-limit' | translate"
          formControlName="inactiveSeedingTimeLimit"
          min="0"
        />
        <label for="inactiveSeedingTimeLimit"
          >{{ 'components.share-limit.inactive-seeding-time-limit' | translate }}</label
        >
      </div>
    </div>

    <div class="col-1 d-flex align-items-center">
      <bb-popover
        class="mt-2"
        [subject]="'components.share-limit.popover.inactive-seeding-time-limit.title' | translate"
        [description]="
            'components.share-limit.popover.inactive-seeding-time-limit.description' | translate
          "
        placement="left"
      ></bb-popover>
    </div>

    <div class="col-12">
      <div class="form-text mt-1 ms-2">
        {{ form.controls.inactiveSeedingTimeLimit.value ?? -1 | timeLimit }}
      </div>
    </div>
    }
  </div>
</div>
```

- [ ] **Step 2: Run lint**

```bash
npm run lint 2>&1 | head -40
```

Expected: zero errors from `share-limit.html`.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/share-limit/share-limit.html
git commit -m "#45: Update share-limit layout to col-5 + col-1 popover with units in labels"
```

---

## Task 4: Create TransferRateLimit component

**Files:**

- Create: `src/app/components/transfer-rate-limit/transfer-rate-limit.ts`
- Create: `src/app/components/transfer-rate-limit/transfer-rate-limit.html`
- Create: `src/app/components/transfer-rate-limit/transfer-rate-limit.scss`
- Create: `src/app/components/transfer-rate-limit/transfer-rate-limit.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/components/transfer-rate-limit/transfer-rate-limit.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransferRateLimit } from './transfer-rate-limit';

describe('TransferRateLimit', () => {
  let component: TransferRateLimit;
  let fixture: ComponentFixture<TransferRateLimit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransferRateLimit],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferRateLimit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- --include="**/transfer-rate-limit.spec.ts" 2>&1 | tail -20
```

Expected: FAIL — component not found.

- [ ] **Step 3: Create the component class**

Create `src/app/components/transfer-rate-limit/transfer-rate-limit.ts`:

```typescript
import { Component, OnInit, forwardRef } from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { SpeedLimitPipe } from '../../pipes/speed-limit-pipe';
import { BbPopover } from '../bb-popover/bb-popover';

export type TransferRateLimitValue = {
  uploadLimit: number | null; // KiB/s; null = no limit (unlimited)
  downloadLimit: number | null; // KiB/s; null = no limit (unlimited)
};

@Component({
  selector: 'app-transfer-rate-limit',
  imports: [ReactiveFormsModule, TranslatePipe, BbPopover, SpeedLimitPipe],
  templateUrl: './transfer-rate-limit.html',
  styleUrl: './transfer-rate-limit.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TransferRateLimit),
      multi: true,
    },
  ],
})
export class TransferRateLimit implements ControlValueAccessor, OnInit {
  public form = new FormGroup({
    uploadLimit: new FormControl<number | null>(null),
    downloadLimit: new FormControl<number | null>(null),
  });

  private onChange: (value: TransferRateLimitValue) => void = () => {};
  private onTouched: () => void = () => {};

  public ngOnInit(): void {
    this.form.valueChanges.subscribe((value) => {
      this.onChange({
        uploadLimit: value.uploadLimit ?? null,
        downloadLimit: value.downloadLimit ?? null,
      });
      this.onTouched();
    });
  }

  public writeValue(value: TransferRateLimitValue | null): void {
    this.form.patchValue(value ?? { uploadLimit: null, downloadLimit: null }, { emitEvent: false });
  }

  public registerOnChange(fn: (value: TransferRateLimitValue) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.form.disable();
    } else {
      this.form.enable();
    }
  }
}
```

- [ ] **Step 4: Create the template**

Create `src/app/components/transfer-rate-limit/transfer-rate-limit.html`:

```html
<div [formGroup]="form" class="container-fluid px-0">
  <div class="row">
    <div class="col-5">
      <div class="form-floating">
        <input
          type="number"
          class="form-control"
          id="uploadLimit"
          [placeholder]="'components.transfer-rate-limit.upload-limit' | translate"
          formControlName="uploadLimit"
          min="0"
        />
        <label for="uploadLimit"
          >{{ 'components.transfer-rate-limit.upload-limit' | translate }}</label
        >
      </div>
    </div>

    <div class="col-1 d-flex align-items-center">
      <bb-popover
        class="mt-2"
        [subject]="'components.transfer-rate-limit.popover.upload-limit.title' | translate"
        [description]="
          'components.transfer-rate-limit.popover.upload-limit.description' | translate
        "
        placement="left"
      ></bb-popover>
    </div>

    <div class="col-12 mb-3">
      <div class="form-text mt-1 ms-2">
        {{ (form.controls.uploadLimit.value ?? 0) * 1024 | speedLimit }}
      </div>
    </div>

    <div class="col-5">
      <div class="form-floating">
        <input
          type="number"
          class="form-control"
          id="downloadLimit"
          [placeholder]="'components.transfer-rate-limit.download-limit' | translate"
          formControlName="downloadLimit"
          min="0"
        />
        <label for="downloadLimit"
          >{{ 'components.transfer-rate-limit.download-limit' | translate }}</label
        >
      </div>
    </div>

    <div class="col-1 d-flex align-items-center">
      <bb-popover
        class="mt-2"
        [subject]="'components.transfer-rate-limit.popover.download-limit.title' | translate"
        [description]="
          'components.transfer-rate-limit.popover.download-limit.description' | translate
        "
        placement="left"
      ></bb-popover>
    </div>

    <div class="col-12">
      <div class="form-text mt-1 ms-2">
        {{ (form.controls.downloadLimit.value ?? 0) * 1024 | speedLimit }}
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Create the empty stylesheet**

Create `src/app/components/transfer-rate-limit/transfer-rate-limit.scss` with empty content (just a newline).

- [ ] **Step 6: Run the test to confirm it passes**

```bash
npm test -- --include="**/transfer-rate-limit.spec.ts" 2>&1 | tail -20
```

Expected: PASS — 1 spec, 0 failures.

- [ ] **Step 7: Run lint**

```bash
npm run lint 2>&1 | head -40
```

Expected: zero errors from the new files.

- [ ] **Step 8: Commit**

```bash
git add src/app/components/transfer-rate-limit/
git commit -m "#45: Add TransferRateLimit reusable ControlValueAccessor component"
```

---

## Task 5: Update LimitTransferRate modal

**Files:**

- Modify: `src/app/components/modals/limit-transfer-rate/limit-transfer-rate.ts`
- Modify: `src/app/components/modals/limit-transfer-rate/limit-transfer-rate.html`

- [ ] **Step 1: Replace the component class**

Replace the entire content of `src/app/components/modals/limit-transfer-rate/limit-transfer-rate.ts`:

```typescript
import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { LimitTargetType } from '../../../models/command.model';
import { QbService } from '../../../services/qb.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import {
  TransferRateLimit,
  TransferRateLimitValue,
} from '../../transfer-rate-limit/transfer-rate-limit';

@Component({
  selector: 'app-limit-transfer-rate',
  imports: [ReactiveFormsModule, TranslatePipe, TransferRateLimit, NgbTooltip, TooltipOverflow],
  templateUrl: './limit-transfer-rate.html',
  styleUrl: './limit-transfer-rate.scss',
})
export class LimitTransferRate implements OnInit {
  @Input() public target!: LimitTargetType;

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly selectionStoreService = inject(SelectionStoreService);
  public activeModal = inject(NgbActiveModal);

  public form = new FormGroup({
    transferRateLimits: new FormControl<TransferRateLimitValue | null>(null),
  });

  public saving = signal<boolean>(false);
  public selected = signal<number>(this.selectionStoreService.selected().length);

  public selectionName = computed(() => {
    const selected = this.selectionStoreService.selected();
    return selected.length === 1 ? selected[0].name : selected.length;
  });

  public tooltipText = computed(() => {
    if (this.target === 'global') return null;
    return String(this.selectionName());
  });

  public async ngOnInit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    let uploadBytes = 0;
    let downloadBytes = 0;

    if (this.target === 'global') {
      [uploadBytes, downloadBytes] = await Promise.all([
        this.qbService.getUploadLimit(serverId) as Promise<number>,
        this.qbService.getDownloadLimit(serverId) as Promise<number>,
      ]);
    } else {
      const selectedTorrents = this.selectionStoreService.selected();
      if (selectedTorrents.length > 0) {
        const torrent = selectedTorrents[0];
        uploadBytes = torrent.up_limit;
        downloadBytes = torrent.dl_limit;
      }
    }

    this.form.controls.transferRateLimits.setValue(
      {
        uploadLimit: uploadBytes > 0 ? Math.floor(uploadBytes / 1024) : null,
        downloadLimit: downloadBytes > 0 ? Math.floor(downloadBytes / 1024) : null,
      },
      { emitEvent: false },
    );
  }

  public async handleSubmit(): Promise<void> {
    this.saving.set(true);
    const serverId = this.serverStoreService.currentServerId() as string;
    const value = this.form.controls.transferRateLimits.value;
    const uploadBytes = (value?.uploadLimit ?? 0) * 1024;
    const downloadBytes = (value?.downloadLimit ?? 0) * 1024;
    const hashes =
      this.target === 'torrent'
        ? this.selectionStoreService.selected().map((t) => t.hash.trim())
        : undefined;

    try {
      await Promise.all([
        this.qbService.setUploadLimit(serverId, uploadBytes, hashes),
        this.qbService.setDownloadLimit(serverId, downloadBytes, hashes),
      ]);
    } catch (error: any) {
      console.error(LimitTransferRate.name, 'handleSubmit', 'Failed to update limits!');
    } finally {
      this.saving.set(false);
      this.activeModal.close();
    }
  }

  public clearAll(): void {
    this.form.controls.transferRateLimits.setValue({
      uploadLimit: null,
      downloadLimit: null,
    });
    this.handleSubmit();
  }

  public hasClearableValues(): boolean {
    const v = this.form.controls.transferRateLimits.value;
    return v !== null && (v.uploadLimit !== null || v.downloadLimit !== null);
  }

  public canSave(): boolean {
    return this.form.valid && !this.saving();
  }
}
```

- [ ] **Step 2: Replace the template**

Replace the entire content of `src/app/components/modals/limit-transfer-rate/limit-transfer-rate.html`:

```html
<div class="modal-header bb-modal-header">
  <div class="bb-modal-header__text">
    <h5 class="modal-title bb-title-clamp">
      {{ 'components.modals.limit-transfer-rate.title' | translate }}
    </h5>

    <div
      class="small text-body-secondary mt-1 bb-hash-clamp"
      [ngbTooltip]="tooltipText()"
      bbTooltipOverflow
      tooltipClass="single-line-tooltip"
      placement="bottom"
    >
      @if (target === 'global') { {{ 'components.modals.limit-transfer-rate.global' | translate }} }
      @else if (selected() === 1) { {{ selectionName() }} } @else { {{
      'general.label.torrent-selected' | translate: { count: selected() } }} }
    </div>
  </div>

  <button
    type="button"
    class="btn-close"
    aria-label="Close"
    (click)="activeModal.dismiss()"
  ></button>
</div>

<div class="modal-body">
  <form [formGroup]="form" (submit)="handleSubmit()">
    <app-transfer-rate-limit formControlName="transferRateLimits"></app-transfer-rate-limit>
    <button type="submit" hidden [disabled]="!canSave()"></button>
  </form>
</div>

<div class="modal-footer">
  <button type="button" class="btn btn-secondary" (click)="handleSubmit()" [disabled]="!canSave()">
    {{ 'general.button.save' | translate }}
  </button>
  @if (hasClearableValues()) {
  <button
    type="button"
    class="btn btn-link text-danger"
    (click)="clearAll()"
    [disabled]="!canSave()"
  >
    {{ 'general.button.clear-all' | translate }}
  </button>
  }
  <button type="button" class="btn btn-link" (click)="activeModal.dismiss()">
    {{ 'general.button.cancel' | translate }}
  </button>
</div>
```

- [ ] **Step 3: Run lint**

```bash
npm run lint 2>&1 | head -40
```

Expected: zero errors from the modal files. Errors from `ui-command-handler.service.ts` (about `direction`) are fixed in Task 7.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/modals/limit-transfer-rate/
git commit -m "#45: Rewrite LimitTransferRate modal to wrap TransferRateLimit component"
```

---

## Task 6: Update add-torrent

**Files:**

- Modify: `src/app/models/add-torrent.model.ts`
- Modify: `src/app/components/add-torrent/add-torrent.ts`
- Modify: `src/app/components/add-torrent/add-torrent.html`

- [ ] **Step 1: Update the model**

Replace the entire content of `src/app/models/add-torrent.model.ts`:

```typescript
import { ShareLimitValue } from '../components/share-limit/share-limit';
import { TransferRateLimitValue } from '../components/transfer-rate-limit/transfer-rate-limit';

export type RootFolderMode = 'unset' | 'true' | 'false';

export type AddTorrentSettings = {
  savepath: string | null;
  paused: boolean;
  category: string | null;
  tags: string | null;
  root_folder: RootFolderMode;
  skip_checking: boolean;
  sequentialDownload: boolean;
  firstLastPiecePrio: boolean;
  autoTMM: boolean;
  transferRateLimits: TransferRateLimitValue | null;
  shareLimits: ShareLimitValue | null;
};

export const DEFAULT_ADD_TORRENT_SETTINGS: AddTorrentSettings = {
  savepath: null,
  paused: false,
  category: null,
  tags: null,
  root_folder: 'unset',
  skip_checking: false,
  sequentialDownload: false,
  firstLastPiecePrio: false,
  autoTMM: false,
  transferRateLimits: null,
  shareLimits: null,
};
```

- [ ] **Step 2: Update the `AddTorrentFormValue` type in add-torrent.ts**

In `src/app/components/add-torrent/add-torrent.ts`, update the local `AddTorrentFormValue` type. Replace:

```typescript
upLimitKbps: number | null;
dlLimitKbps: number | null;
shareLimits: ShareLimitValue | null;
```

With:

```typescript
transferRateLimits: TransferRateLimitValue | null;
shareLimits: ShareLimitValue | null;
```

- [ ] **Step 3: Add the `TransferRateLimit` import and update the form declaration**

Add to the imports at the top of `add-torrent.ts`:

```typescript
import {
  TransferRateLimit,
  TransferRateLimitValue,
} from '../transfer-rate-limit/transfer-rate-limit';
```

Add `TransferRateLimit` to the component's `imports` array (alongside `ShareLimit`).

In the `addForm` FormGroup declaration, replace:

```typescript
    upLimitKbps: new FormControl<number | null>(null),
    dlLimitKbps: new FormControl<number | null>(null),
```

With:

```typescript
    transferRateLimits: new FormControl<TransferRateLimitValue | null>(null),
```

- [ ] **Step 4: Update the submit payload in add-torrent.ts**

In `handleSubmit`, replace:

```typescript
        upLimit: raw.upLimitKbps != null ? String(Math.round(raw.upLimitKbps * 1024)) : undefined,
        dlLimit: raw.dlLimitKbps != null ? String(Math.round(raw.dlLimitKbps * 1024)) : undefined,
```

With:

```typescript
        upLimit:
          raw.transferRateLimits?.uploadLimit != null
            ? String(Math.round(raw.transferRateLimits.uploadLimit * 1024))
            : undefined,
        dlLimit:
          raw.transferRateLimits?.downloadLimit != null
            ? String(Math.round(raw.transferRateLimits.downloadLimit * 1024))
            : undefined,
```

- [ ] **Step 5: Update the settings save call in add-torrent.ts**

In the same `handleSubmit`, replace the `addTorrentSettings.save({...})` call's relevant fields:

```typescript
        upLimitKbps: raw.upLimitKbps,
        dlLimitKbps: raw.dlLimitKbps,
```

With:

```typescript
        transferRateLimits: raw.transferRateLimits,
```

- [ ] **Step 6: Update the template**

In `src/app/components/add-torrent/add-torrent.html`, find the two `col-6` blocks for `upLimitKbps` and `dlLimitKbps` (they appear inside the `"Limits"` fieldset). Replace both blocks with:

```html
<div class="col-12 mb-3">
  <app-transfer-rate-limit formControlName="transferRateLimits"></app-transfer-rate-limit>
</div>
```

- [ ] **Step 7: Run lint**

```bash
npm run lint 2>&1 | head -40
```

Expected: zero errors from the add-torrent and model files.

- [ ] **Step 8: Commit**

```bash
git add src/app/models/add-torrent.model.ts src/app/components/add-torrent/
git commit -m "#45: Replace add-torrent inline rate inputs with TransferRateLimit component"
```

---

## Task 7: Update context menu and command handler

**Files:**

- Modify: `src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`
- Modify: `src/app/services/ui-command-handler.service.ts`

- [ ] **Step 1: Update grid-context-menu.service.ts**

In `src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`:

**Remove** `faUpload` and `faDownload` from the import block:

```typescript
// Remove these two from the import:
  faDownload,
  faUpload,
```

**Replace** the two items `speed.limitUpload` and `speed.limitDownload` with a single item:

```typescript
          {
            kind: 'item',
            id: 'speed.limitTransferRate',
            label: 'pages.main.grid.context-menu.item.limit-transfer-rate',
            icon: faArrowsLeftRight,
            action: () =>
              this.commandBusService.emit({
                type: 'UI_LIMIT_TRANSFER',
                target: 'torrent',
              }),
          },
```

Note: `faArrowsLeftRight` is already imported in this file.

- [ ] **Step 2: Update ui-command-handler.service.ts**

In `src/app/services/ui-command-handler.service.ts`, in the `case 'UI_LIMIT_TRANSFER':` block, remove the line:

```typescript
limitTransferModalRef.componentInstance.direction = command.direction;
```

The block should look like:

```typescript
          case 'UI_LIMIT_TRANSFER':
            if (this.isModalOpen(LimitTransferRate)) break;
            const limitTransferModalRef = this.modalService.open(LimitTransferRate, {
              centered: true,
            });

            limitTransferModalRef.componentInstance.target = command.target;

            limitTransferModalRef.result.then((res: any) => {}).catch((error: any) => {});
            break;
```

- [ ] **Step 3: Remove the `LimitDirectionType` import if present**

In `ui-command-handler.service.ts`, if `LimitDirectionType` was imported from `command.model`, remove that import.

- [ ] **Step 4: Run lint — should be clean**

```bash
npm run lint 2>&1 | head -40
```

Expected: zero warnings and zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/main/grid/context-menu/grid-context-menu.service.ts \
        src/app/services/ui-command-handler.service.ts
git commit -m "#45: Merge upload/download context menu items into single limit transfer rate action"
```

---

## Self-Review Checklist (run before declaring done)

- [ ] `npm run lint` passes with zero warnings
- [ ] `npm test` passes (all existing specs + new `transfer-rate-limit.spec.ts`)
- [ ] `npm start` — open add-torrent dialog, confirm two rate inputs appear under "Limits" with human-readable speed below each
- [ ] Right-click a torrent → Transfer submenu — confirm single "Limit Transfer Rate" item; opening it shows both upload and download fields
- [ ] Verify "Clear all" button appears (red link) when either limit is set, and disappears when both are cleared
- [ ] Verify share-limit fields in add-torrent and limit-torrent-share modal are now `col-5` with units in labels and no appended unit badge
