# Design: Manage Labels and Categories Modals

**Date:** 2026-05-21
**Issue:** #100

## Overview

Two separate small modal components for managing qBittorrent labels (tags) and categories. Both are opened via the command bus so they can be triggered from the UI and from the Electron application menu. The ng-select components used in the Add Torrent form gain a footer template link to open each modal. Inline tag creation is removed from the tag select since the manager makes it redundant.

## Components

### `manage-labels` modal

**Path:** `packages/app/src/app/components/modals/manage-labels/`

**Layout:**

- `modal-header`: title "Manage Labels" + X dismiss button
- `modal-body`:
  - Add form: single floating input (label name) + Add button, using the same visual structure as the category form
  - List-group below: one row per label showing the name and a red Delete button
- `modal-footer`: single Close button (`activeModal.dismiss()`)

**Behaviour:**

- Loads all tags via `qbService.getAllTags()` on init into a `signal<string[]>`
- Add: calls `qbService.createTags()` immediately, updates the signal
- Delete: calls `qbService.deleteTags()` immediately, removes from signal
- No editing - labels are add/delete only

### `manage-categories` modal

**Path:** `packages/app/src/app/components/modals/manage-categories/`

**Layout:**

- `modal-header`: title "Manage Categories" + X dismiss button
- `modal-body`:
  - Add form: floating input (name) + floating input (save path, optional) + Add button
  - List-group below: each row shows name (bold) and save path below it; Edit + Delete buttons
  - Inline edit (Option A - row transforms in place): name is read-only, only save path is editable; Save + Cancel buttons
- `modal-footer`: single Close button

**Behaviour:**

- Loads all categories via `qbService.getAllCategories()` on init into a `signal<{name: string, savePath: string}[]>`
- Add: calls `qbService.addCategory()` immediately, updates signal
- Edit (save path only): calls `qbService.editCategory()` on Save - name cannot be changed because the API has no rename endpoint
- Delete: calls `qbService.removeCategories()` immediately
- Only one row can be in edit mode at a time

## Command Bus

Two new variants added to `UiCommand` in `packages/app/src/app/models/command.model.ts`:

```typescript
| { type: 'UI_MANAGE_LABELS' }
| { type: 'UI_MANAGE_CATEGORIES' }
```

Both handled in `UiCommandHandlerService`. No explicit size override - the modals open at default Bootstrap modal width (not `lg` or `xl`).

## ng-select Footer Templates

- `tag-select.html`: add `[footerTemplate]="manageFooter"` to `<ng-select>` and an `<ng-template #manageFooter>` with a small "Manage labels..." link that emits `UI_MANAGE_LABELS` via `CommandBusService`
- `category-select.html`: same pattern, emits `UI_MANAGE_CATEGORIES`
- Both component classes gain `CommandBusService` injection

## Remove Inline Tag Creation

The `tag-select` component currently supports adding a new tag inline via ng-select's `addTag` feature. This is no longer needed now that the manager modal exists.

Changes to `tag-select.ts`:

- Remove the `addTag` method

Changes to `tag-select.html`:

- Remove `[addTag]="addTag"` binding
- Keep `[openOnEnter]="false"` - this is a general UX preference shared with category-select, not specific to inline adds

## Electron Application Menu

Two new menu items added under the Settings submenu in the Electron application menu, wired to `UI_MANAGE_LABELS` and `UI_MANAGE_CATEGORIES` via the existing IPC mechanism. Follows the same pattern as other menu items that trigger UI commands.

## CLAUDE.md Git Workflow Instructions

A new section added to `CLAUDE.md` covering:

- **Issue templates:** When opening new issues, use the appropriate template from `.github/ISSUE_TEMPLATE/`
- **PR template:** PR descriptions must follow `.github/pull_request_template.md`
- **Feature branch naming:** `<issue-id>-<dash-separated-summary>` e.g. `100-manage-labels-and-categories`
- **PR title:** Clean description only - do not include the issue ID in the PR title (the link goes in the body as `Fixes #ID`)

## Out of Scope

- Renaming labels (no API endpoint; delete + recreate would orphan torrent assignments)
- Renaming categories (same constraint - `editCategory` only changes save path)
- Refreshing the ng-select list after the manager modal closes (the modal manages its own local signal; the selects reload on next open)
