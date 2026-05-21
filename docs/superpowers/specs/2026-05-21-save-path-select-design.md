# Save-Path Select — Reusable Component Design

**Date:** 2026-05-21
**Branch:** 100-manage-labels-and-categories

## Problem

`SavePathSelect` is a reusable ng-select wrapper for picking a torrent save path. It already works in `add-torrent` and `set-torrent-location`. Two new use cases require the same control:

1. `manage-categories` — add form (save path is optional, clearable, no popover needed)
2. `manage-categories` — edit row (same as above, label shows the category name)

Additionally, `server.ts` (path mappings remote field) has a manual copy of the same `paths()` computed signal, `addTag`, and `keyDownFn` that already exist inside `SavePathSelect`. That duplication is eliminated in the same pass.

## Component API Changes

Three new `@Input()` properties are added to `SavePathSelect`:

| Input         | Type             | Default | Notes                                                                                                                                                     |
| ------------- | ---------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clearable`   | `boolean`        | `false` | Existing callers get non-clearable by default (matching the new intended behaviour for add-torrent and set-location)                                      |
| `showPopover` | `boolean`        | `true`  | Existing callers keep the popover with no template changes                                                                                                |
| `label`       | `string \| null` | `null`  | `null` uses the default `components.save-path-select.label` translation; a non-null string is used as-is (for "Remote path" and `item.name` in edit mode) |

`autofocus` stays unchanged.

### Use-case matrix

| Context                | `clearable`       | `showPopover`    | `label`                         |
| ---------------------- | ----------------- | ---------------- | ------------------------------- |
| add-torrent            | `false` (default) | `true` (default) | `null` (default)                |
| set-torrent-location   | `false` (default) | `true` (default) | `null` (default)                |
| manage-categories add  | `true`            | `false`          | `null` (default)                |
| manage-categories edit | `true`            | `false`          | `item.name`                     |
| server path mappings   | `true`            | `false`          | translated "Remote path" string |

## Template Structure (`save-path-select.html`)

Two layout branches on `showPopover`:

**`showPopover = true` (unchanged):**
`container-fluid px-0 > row > col-11 (form-floating + ng-select + label) + col-1 (bb-popover)`

**`showPopover = false` (new):**
Just `div.form-floating > ng-select + label` — no outer grid wrapper.

The `[clearable]` binding on `<ng-select>` switches from the hardcoded `true` to `[clearable]="clearable"`.

The label resolves as: `label ?? ('components.save-path-select.label' | translate)` via an `@let` in the template.

## `manage-categories` Changes

### Add form

- `savePath` `FormControl` type changes from `FormControl<string>` to `FormControl<string | null>` with initial value `null`.
- The plain `<input>` in the add row is replaced with `<app-save-path-select [showPopover]="false" [clearable]="true" formControlName="savePath">`.
- The `(keydown.enter)="add()"` binding is dropped from the save-path control. `SavePathSelect`'s Enter already selects/confirms a value from the dropdown; a separate keydown.enter handler would double-fire. The user confirms via the Add button.
- The existing save logic `(this.addForm.get('savePath')?.value ?? '').trim()` already coerces `null` to empty string - no change needed there.

### Edit row

- `editSavePathControl` type changes from `FormControl<string>` to `FormControl<string | null>`.
- `startEdit` sets the control to `item.savePath || null` (empty savePath opens as null, not empty string, so the placeholder is visible).
- The plain `<input>` is replaced with `<app-save-path-select [showPopover]="false" [clearable]="true" [label]="item.name" [formControl]="editSavePathControl">`.
- Keyboard behaviour: `(keydown.enter)="saveEdit(item)"` stays on the parent `<li>`. When the ng-select dropdown is open, Enter selects the highlighted item and the event bubbles to `<li>`, triggering `saveEdit` — acceptable UX (select and confirm in one keystroke). `(keydown.escape)="cancelEdit()"` stays on the `<li>`; `SavePathSelect.keyDownFn` returns `false` for Escape so ng-select skips its handling and the event bubbles to the `<li>`.

## `server.ts` / `server.html` Changes

### `server.ts`

Remove the three members that duplicate `SavePathSelect` internals:

- `paths` computed signal (lines 58-68)
- `addTag` method (line 70)
- `keyDownFn` method (lines 72-77)

Add `SavePathSelect` to the component's `imports` array.

### `server.html`

Replace the entire `<div class="form-floating"> <ng-select ...> <label>...</label> </div>` block for the remote path field with:

```html
<app-save-path-select
  [showPopover]="false"
  [clearable]="true"
  [label]="'pages.settings.tab.server.server-settings-form.path-mapping.remote-path' | translate"
  formControlName="remote"
></app-save-path-select>
```

`appendTo="ngb-modal-window"` is dropped — the settings page is not inside a modal, so it was already inert.

## Files Changed

| File                                                                              | Nature of change                                                            |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/app/src/app/components/save-path-select/save-path-select.ts`            | Add 3 inputs                                                                |
| `packages/app/src/app/components/save-path-select/save-path-select.html`          | Conditional layout; `[clearable]` binding; label resolution                 |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`   | Import `SavePathSelect`; change two `FormControl` types; update `startEdit` |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.html` | Replace two plain inputs with `<app-save-path-select>`                      |
| `packages/app/src/app/pages/settings/server/server.ts`                            | Remove 3 duplicated members; import `SavePathSelect`                        |
| `packages/app/src/app/pages/settings/server/server.html`                          | Replace inline `<ng-select>` block with `<app-save-path-select>`            |

## Files Not Changed

- `add-torrent.ts` / `add-torrent.html` — new defaults match current behaviour exactly
- `set-torrent-location.ts` / `set-torrent-location.html` — new defaults match current behaviour exactly
