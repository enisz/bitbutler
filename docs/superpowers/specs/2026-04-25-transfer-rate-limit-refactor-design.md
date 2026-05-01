# Transfer Rate Limit Refactor — Design Spec

**Issue:** #45
**Date:** 2026-04-25

## Overview

Refactor the transfer rate limit UI to match the established `share-limit` pattern: extract a reusable `TransferRateLimit` ControlValueAccessor component, update the modal to wrap it, replace inline inputs in `add-torrent`, consolidate the context menu to a single entry, and remove `input-group-text` unit tags from both the new component and `share-limit` in favour of units in form labels.

---

## 1. New reusable component — `TransferRateLimit`

**Location:** `src/app/components/transfer-rate-limit/`
**Files:** `transfer-rate-limit.ts`, `transfer-rate-limit.html`, `transfer-rate-limit.scss`, `transfer-rate-limit.spec.ts`

### Value type

Exported from `transfer-rate-limit.ts`:

```typescript
export type TransferRateLimitValue = {
  uploadLimit: number | null; // KiB/s; null = no limit
  downloadLimit: number | null; // KiB/s; null = no limit
};
```

### Component class

- Implements `ControlValueAccessor` (with `NG_VALUE_ACCESSOR` provider, `forwardRef`)
- `FormGroup` with two `FormControl<number | null>` fields: `uploadLimit`, `downloadLimit`
- `ngOnInit` subscribes to `form.valueChanges` → calls `onChange` + `onTouched`
- Standard `writeValue`, `registerOnChange`, `registerOnTouched`, `setDisabledState`

### Template layout

Two rows, one per direction. Each row:

```
[col-5: form-floating input] [col-1: bb-popover (placement="left")]
[col-12: form-text — human-readable speed]
```

- No `input-group` wrapper, no `input-group-text`
- Label text includes the unit, e.g. `"Upload Limit (KiB/s)"` (from translation key)
- `form-text` displays: `(form.controls.uploadLimit.value ?? 0) * 1024 | speedLimit`
  - The existing `SpeedLimitPipe` takes bytes; multiplying KiB/s × 1024 converts to bytes/s
  - Shows `"-"` when value is `0` or null (pipe already handles `limit <= 0`)
- Popovers explain that 0 means unlimited

### Translation keys (new, under `components.transfer-rate-limit`)

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

---

## 2. Updated `LimitTransferRate` modal

**Location:** `src/app/components/modals/limit-transfer-rate/` (files stay, content updated)

### Inputs

- `@Input() target: LimitTargetType` — kept (`'global'` | `'torrent'`)
- `@Input() direction` — **removed**

### Form

Replace `limitTransferForm` (single `limit` field) with:

```typescript
form = new FormGroup({
  transferRateLimits: new FormControl<TransferRateLimitValue | null>(null),
});
```

### `ngOnInit`

Loads both upload and download limits based on `target`:

- `target === 'global'`: calls `qbService.getUploadLimit` and `qbService.getDownloadLimit` in parallel
- `target === 'torrent'`: reads `up_limit` and `dl_limit` from the first selected torrent

Converts from bytes to KiB/s (divide by 1024, treat 0 as null/no-limit) and writes to the form control.

### `handleSubmit`

Reads `TransferRateLimitValue` from the form, converts null → 0 and KiB/s → bytes (× 1024), calls both `setUploadLimit` and `setDownloadLimit` in parallel.

### Template

- Uses `<app-transfer-rate-limit formControlName="transferRateLimits">`
- Modal title: single key `"Limit Transfer Rate"` (no longer upload/download variants)
- Footer buttons:
  - **Save** — `btn-secondary`, calls `handleSubmit()`
  - **Clear all** — `btn-link text-danger`, visible when either limit is non-null, sets both to null and submits
  - **Cancel** — `btn-link`, dismisses modal

### `hasClearableValues()` helper

```typescript
hasClearableValues(): boolean {
  const v = this.form.controls.transferRateLimits.value;
  return v !== null && (v.uploadLimit !== null || v.downloadLimit !== null);
}
```

### Translation keys updated (under `components.modals.limit-transfer-rate`)

Remove: `title-upload`, `title-download`, `limit-upload`, `limit-download`, `clear-limit`

Add:

```json
"title": "Limit Transfer Rate",
"global": "Global Transfer Limit"   // kept as-is
```

---

## 3. `add-torrent` update

### Template

Replace the two `col-6` `input-group` blocks for `upLimitKbps` and `dlLimitKbps` with:

```html
<div class="col-12">
  <app-transfer-rate-limit formControlName="transferRateLimits"></app-transfer-rate-limit>
</div>
```

### Component class

- Remove `upLimitKbps` and `dlLimitKbps` `FormControl` fields
- Add `transferRateLimits: new FormControl<TransferRateLimitValue | null>(null)`
- Update submit logic: read from `transferRateLimits`, convert null → 0, KiB/s → bytes (× 1024)
- Add `TransferRateLimit` to imports; remove any import no longer needed

### Translation keys removed (from `components.add-torrent.add-form`)

- `up-limit`, `down-limit`, `seeding-time-limit-unit` (the inline unit label key)

---

## 4. Command model changes

**File:** `src/app/models/command.model.ts`

- Remove `LimitDirectionType` type export
- Change `UI_LIMIT_TRANSFER` command: remove `direction` field

```typescript
// Before
| { type: 'UI_LIMIT_TRANSFER'; direction: LimitDirectionType; target: LimitTargetType }

// After
| { type: 'UI_LIMIT_TRANSFER'; target: LimitTargetType }
```

**File:** `src/app/services/ui-command-handler.service.ts`

- Remove `direction` from the modal open call
- No other changes needed

---

## 5. Context menu changes

**File:** `src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`

Replace the two items `speed.limitUpload` and `speed.limitDownload` with a single item:

```typescript
{
  kind: 'item',
  id: 'speed.limitTransferRate',
  label: 'pages.main.grid.context-menu.item.limit-transfer-rate',
  icon: faGaugeHigh,  // or another suitable speed icon from FontAwesome
  action: () => this.commandBusService.emit({ type: 'UI_LIMIT_TRANSFER', target: 'torrent' }),
}
```

- Remove `faUpload` and `faDownload` imports if unused elsewhere
- Add `faGaugeHigh` (or chosen icon) import

### Translation keys

Remove:

- `pages.main.grid.context-menu.item.limit-upload-rate`
- `pages.main.grid.context-menu.item.limit-download-rate`

Add:

- `pages.main.grid.context-menu.item.limit-transfer-rate` → `"Limit Transfer Rate"`

---

## 6. `share-limit` layout update

**File:** `src/app/components/share-limit/share-limit.html`

All three fields (`ratioLimit`, `seedingTimeLimit`, `inactiveSeedingTimeLimit`) get the same layout used in `TransferRateLimit`:

```
[col-5: form-floating input] [col-1: bb-popover (placement="left")]
[col-12: form-text — human-readable value]
```

Changes per field:

- `ratioLimit`: change `col-11` → `col-5`; popover stays `col-1`; no other structural change (no input-group here already)
- `seedingTimeLimit`: change `col-11` → `col-5`; remove `<div class="input-group">` wrapper and `<span class="input-group-text">`; popover stays `col-1`
- `inactiveSeedingTimeLimit`: same as `seedingTimeLimit`

Unit moves into the label for the time fields, e.g. `"Seeding Time Limit (min)"`.

### Translation keys updated (under `components.share-limit`)

- Remove: `time-unit`
- Update: `seeding-time-limit` → `"Seeding Time Limit (min)"`
- Update: `inactive-seeding-time-limit` → `"Inactive Seeding Time Limit (min)"`

---

## 7. Files changed summary

| File                                                                     | Change                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `src/app/components/transfer-rate-limit/*`                               | **New** — reusable ControlValueAccessor                             |
| `src/app/components/modals/limit-transfer-rate/limit-transfer-rate.ts`   | Rewrite — wraps new component                                       |
| `src/app/components/modals/limit-transfer-rate/limit-transfer-rate.html` | Rewrite — new layout                                                |
| `src/app/components/add-torrent/add-torrent.ts`                          | Update form controls                                                |
| `src/app/components/add-torrent/add-torrent.html`                        | Replace inline inputs                                               |
| `src/app/components/share-limit/share-limit.html`                        | col-11 → col-5, remove input-group on time fields, unit into labels |
| `src/app/models/command.model.ts`                                        | Remove `LimitDirectionType`, update command                         |
| `src/app/services/ui-command-handler.service.ts`                         | Remove `direction` from modal open                                  |
| `src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`      | Merge two items into one                                            |
| `public/i18n/us.json`                                                    | Add/remove/update translation keys                                  |
| `public/i18n/hu.json`                                                    | Add/remove/update translation keys                                  |
