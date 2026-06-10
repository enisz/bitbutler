# Login Page Responsive Redesign

**Date:** 2026-06-09

## Summary

Replace the fixed-size centered login page with a responsive two-column layout. Remove all programmatic window sizing from the login/logout flow. Start the app maximized. Embed server management via a "Manage Servers" button that opens the existing `ManageServers` modal with connect buttons suppressed.

---

## Goals

- App starts maximized; window size is never tampered with programmatically.
- Login page uses the full window width with a two-column hero + form layout.
- The ng-select is clean - no inline edit/delete/auto-login buttons per option.
- Users manage servers (add/edit/delete/auto-login) through the `ManageServers` modal, accessible from a button on the login page.
- The connect button in `ManageServers` is hidden when opened from the login page context.

## Out of scope

- Changes to `ServerEditor`, `CredentialPrompt`, or any other modals.
- Changing the `ManageServers` connect flow itself (only the button visibility changes).
- Changes to the settings page or logout behavior beyond removing the `setSize` call.

---

## Changes

### 1. Electron - start maximized (`packages/electron/src/main.ts`)

After `createOrRestoreMainWindow(startMinimized)`, call `mainWindow.maximize()` when `!startMinimized`:

```typescript
const mainWindow = createOrRestoreMainWindow(startMinimized);
if (!startMinimized) mainWindow.maximize();
```

The hardcoded `600 × 750` in `createMainWindow` stays as the unmaximized/restored fallback size. No other changes to `main-window.ts`.

### 2. Angular - remove window sizing from login/logout (`packages/app/`)

- `login.ts` `ngOnInit`: remove `this.windowService.setSize(600, 750)`.
- Audit `connect()` and command handlers (particularly `UiCommandHandlerService`, `ServerCommandHandlerService`) for any `maximize()` or `setSize()` calls triggered by login success or logout. Remove them. Window state is entirely user-driven after this change.

### 3. Angular - login page layout (`packages/app/src/app/pages/login/`)

#### `login.html` - two-column structure

Replace the current full-height vertical stack with:

```
<div class="login-container">           <!-- flex row, 100vw × 100vh -->

  <div class="login-hero-side">         <!-- flex 0 0 45%, d-none d-md-flex -->
    logo image (NgOptimizedImage)
    version badge (near logo, replaces fixed-position badge)
    "BitButler" h1
    tagline (translated)
  </div>

  <div class="login-form-side">         <!-- flex 1 -->
    <div class="mobile-brand-header d-md-none">  <!-- compact logo + title -->
    <div class="form-wrapper">          <!-- max-width 420px, centered -->
      "Connect to Server" heading
      ng-select (server selection, label-template only)
      Connect button
      Manage Servers button
    </div>
  </div>

</div>
```

The mobile brand header mirrors the template's `d-md-none` block: smaller logo image, title, tagline.

#### `login.html` - ng-select

Remove the `ng-template ng-option-tmp` block (the entire template with edit/delete/auto-login buttons). Keep only `ng-label-tmp` for the selected item display and the existing bindings (`bindLabel`, `bindValue`, `[items]`, etc.).

#### `login.ts`

- Remove: `icon`, `editServer`, `deleteServer`, `toggleAutoLogin` (server CRUD methods no longer called from this page).
- Keep: `trackByFn` - it is bound to the `ng-select` component directly (`[trackByFn]="trackByFn"`), not only used in the removed option template.
- Remove imports: `FontAwesomeModule`, `NgbDropdownModule`, `faEdit`, `faSquare`, `faSquareCheck`, `faTrashCan` (verify none remain used after removing the above).
- Add: `openManageServers()` method that opens `ManageServers` via `NgbModal` and sets `hideConnect = true` via `setModalInput`.
- Add `ManageServers` to the component's `imports` array.

**Auto-login:** Removing the inline toggle from ng-select does not eliminate the feature. Users manage auto-login through the server editor (the auto-login checkbox is already present in `ServerEditor`), accessible via Manage Servers → Edit.

#### `login.scss`

Replace with styles derived from the template, mapped entirely to existing app CSS tokens:

| Template var        | App token                 |
| ------------------- | ------------------------- |
| `--bs-body-bg`      | unchanged                 |
| `--bs-card-bg`      | unchanged                 |
| `--bs-border-color` | unchanged                 |
| `--bs-secondary`    | unchanged (accent color)  |
| `--bs-primary`      | unchanged (heading color) |

Key rules needed:

- `.login-container` - flex row, full viewport
- `.login-hero-side` - 45% flex basis, card-bg, border-right, radial gradient pseudo-element
- `.login-form-side` - flex 1, body-bg, centered
- `.form-wrapper` - max-width 420px, fade-in animation
- `.hero-logo-wrapper` - relative, for badge positioning
- `.hero-version-badge` - absolute top-right of logo wrapper
- `.mobile-brand-header` - d-md-none, text-center
- Remove `.server-name` truncation rule (no longer needed).
- Keep `::ng-deep .tooltip` z-index rule.

### 4. Angular - ManageServers (`packages/app/src/app/components/modals/manage-servers/`)

#### `manage-servers.ts`

Add an input:

```typescript
@Input() hideConnect = false;
```

#### `manage-servers.html`

Wrap the connect button (and its spinner sibling) in a conditional:

```html
@if (!hideConnect) {
<button type="button" class="btn btn-link p-1" ...>...</button>
}
```

The active-server plug icon (non-interactive, just the indicator) stays visible regardless - it is not a connect button.

---

## CSS variable mapping reference

The template introduces several custom tokens that do not exist in the current app. These should either be added to the app's theme SCSS or inlined in `login.scss` as local variables:

| Token                      | Value / derivation                                          |
| -------------------------- | ----------------------------------------------------------- |
| `--bb-control-bg`          | `color-mix(in srgb, var(--bs-card-bg) 72%, #000 28%)`       |
| `--bb-control-border`      | `color-mix(in srgb, var(--bs-border-color) 85%, #fff 15%)`  |
| `--bb-control-placeholder` | `color-mix(in srgb, var(--bs-body-color) 60%, transparent)` |
| `--bb-control-radius`      | `12px`                                                      |
| `--bb-hover-list-item-bg`  | `color-mix(in srgb, var(--bs-secondary) 10%, transparent)`  |
| `--bb-primary-ink`         | `#000`                                                      |

Check whether any of these already exist in the app's theme files before adding them. If they are useful globally (e.g. `--bb-control-bg` for inputs), add them to the theme; otherwise define them locally in `login.scss`.

---

## File change summary

| File                                                                        | Change                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `packages/electron/src/main.ts`                                             | Add `mainWindow.maximize()` call                                 |
| `packages/app/src/app/pages/login/login.ts`                                 | Remove setSize, icon, server CRUD methods; add openManageServers |
| `packages/app/src/app/pages/login/login.html`                               | Full rewrite to two-column layout                                |
| `packages/app/src/app/pages/login/login.scss`                               | Full rewrite with new layout styles                              |
| `packages/app/src/app/components/modals/manage-servers/manage-servers.ts`   | Add `@Input() hideConnect`                                       |
| `packages/app/src/app/components/modals/manage-servers/manage-servers.html` | Conditionally hide connect button                                |
| `packages/app/src/styles/themes/*.scss` _(maybe)_                           | Add shared control CSS tokens if globally useful                 |
