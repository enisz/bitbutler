# Configuration import entry points

## Goal

Rework where configuration import/export is reachable. Export stays a single
step that saves everything. Import is a modal that lets the user choose what to
restore, reachable from the login page, the Manage servers modal and the
settings page.

## Decisions

- **Export** always contains everything (servers and app settings). The user
  only picks where the file is saved. No scope choice.
- **Import** is a modal. The user chooses which parts to restore: servers,
  app settings, or both.
- **Server identity** is the existing `id` (`crypto.randomUUID()`, TEXT primary
  key). An imported server whose `id` already exists overwrites the existing
  one - this is treated as intentional. Server ID generation is not changed.
- Credential clearing when an import repoints a server (existing behaviour)
  is kept.
- **No dedicated settings pane.** The settings page gets only buttons that open
  the export/import flows.

## Entry points

1. **Login page** - the import button is shown only when no servers exist.
   When at least one server exists, it is hidden (Connect and Manage servers
   remain). The hint text above it is shown only together with the button.
2. **Manage servers modal** - a new "Import servers" button opens the same
   import modal with "servers" preselected and the app-settings option hidden.
3. **Settings page** - an Export button (save dialog) and an Import button
   (opens the import modal with all options).

## Importing over the active server

Applies only when a server is logged in and its `id` is among the selected
servers to import.

- The server's row in the import modal shows a short note: "This is your
  current server".
- At the apply step a confirmation modal states that the restore will log the
  user out. The confirm button reads "Restore and log out".
- The logout happens only after the import succeeds; on failure the user stays
  connected.
- No warning when the current server is not selected, when only app settings
  are imported, or on the login page (no active server).

## Out of scope

- Rendering the import modal's choices as settings panes.
- Changing how server IDs are generated.

## Delivery order

1. Login page: hide the import button when servers exist.
2. Import modal: scope choice, current-server note, confirm-and-logout step.
3. Manage servers: "Import servers" button using the modal in servers-only mode.
4. Settings: Export and Import buttons.
5. Translations in `us.json` and `hu.json` for every new string.
