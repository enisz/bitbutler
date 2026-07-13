# Login Screen Empty State (#224)

## Problem

The login screen always renders the host selector dropdown, the Connect
button, and the Manage Servers button, even when no server has ever been
configured. In that state the dropdown just shows "No hosts", Connect is
disabled, and the subtitle ("Select a host to connect to.") doesn't match
what the user can actually do. First-run users have to know to click
"Manage Servers" to find the add-server flow.

## Goal

When zero servers are configured, replace the selector/Connect/Manage
Servers UI with a single "Add Server" call to action. As soon as a server
exists (already configured, or just added from this screen), the screen
reverts to the current layout automatically.

## Design

### Template (`packages/app/src/app/pages/login/login.html`)

- Wrap the existing host-selector `<form>` and the Connect/Manage Servers
  button group in `@if (hasServers()) { ... } @else { ... }`.
- The `@else` branch renders one full-width primary button (`btn-lg
btn-primary btn-split`, same sizing as the current Connect button) with
  a plus icon (`faPlus`) and the existing `general.button.add-server`
  label ("Add Server"), bound to `(click)="addNewServer()"`.
- The subtitle under the form title switches between the existing
  `pages.login.form-subtitle` and a new `pages.login.form-subtitle-empty`
  key based on `hasServers()`.
- Everything else on the page (hero panel, version/link row, language /
  theme family / theme mode dropdowns) is unaffected.

### Component (`packages/app/src/app/pages/login/login.ts`)

- Add `public readonly hasServers = computed(() => this.servers().length > 0);`.
- Add `faPlus` to the `icons` object (import from
  `@fortawesome/free-solid-svg-icons`).
- Add `addNewServer()`:
  - Dynamically imports `ServerEditor` (same lazy-import pattern already
    used by `openManageServers()` and by `ManageServers.openEditor()`).
  - Opens it with `modalService.open(ServerEditor, { size: 'lg' })` and no
    `id` input, i.e. add mode.
  - On success (`await ref.result` resolves with the new server id),
    emits `commandBusService.emit({ type: 'SERVER_ADDED', id: newId })`.
  - On dismiss/cancel, does nothing (mirrors `ManageServers.openEditor`).
- No manual "switch layout back" logic is needed:
  `ServerCommandHandlerService.handleServerAdded` already refreshes
  `ServerStoreService` (which updates the `servers()` signal) and
  auto-selects the new server when `currentServerId()` is empty, so
  `hasServers()` recomputes and the template flips back to the normal
  layout with the new server pre-selected in the dropdown. The user still
  clicks Connect manually, consistent with the normal flow.

### i18n (`public/i18n/us.json`, `public/i18n/hu.json`)

Add one new key under `pages.login`, alongside the existing
`form-subtitle`:

- `us.json`: `"form-subtitle-empty": "Add a server to get started."`
- `hu.json`: `"form-subtitle-empty": "Adj hozzá egy szervert a kezdéshez."`

The button label reuses the existing `general.button.add-server` key
("Add Server" / "Szerver hozzáadása") - no new key needed there.

## Out of scope

- No changes to `ManageServers` or `ServerEditor` themselves.
- No auto-connect after adding a server from the empty state - the user
  presses Connect manually, same as any other server selection.
- No change to the `showHero()` responsive hero-panel behavior.

## Testing

- `login.spec.ts`: add cases asserting the empty-state button/subtitle
  render when `servers()` is empty, and that the normal selector/Connect/
  Manage-Servers UI renders once a server is present.
- Manual check: fresh install (no servers) shows the Add Server button;
  adding a server flips the screen back to the normal layout with the new
  server selected.
