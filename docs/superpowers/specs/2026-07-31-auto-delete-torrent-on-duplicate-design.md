# Auto-delete torrent file when torrent already exists in the list

Issue: #243

## Problem

The "Torrent Exists" modal (`packages/app/src/app/modals/torrent-exists/`) shows a manual
"Delete Torrent File" button. It only renders when the general setting
`behavior.deleteTorrentFile` ("Delete torrent files after adding them to the list.") is on, and
requires the user to click it every time a duplicate is detected. We want this to happen
automatically instead, controlled by its own opt-in switch, and remove the manual button.

## Design

### 1. Settings model

`packages/app/src/app/models/general-settings.model.ts`

Add a new field to `GeneralSettings.behavior`:

```ts
behavior: {
  deleteTorrentFile: boolean;
  deleteTorrentFileOnDuplicate: boolean; // new
  automaticUpdate: boolean;
  toastPosition: ToastPosition;
}
```

Default: `deleteTorrentFileOnDuplicate: false` in `DEFAULT_GENERAL_SETTINGS`.

### 2. General settings page

`packages/app/src/app/modals/settings/general/general.ts` / `general.html`

Add a new switch, `deleteTorrentFileOnDuplicate`, in the "Behavior" fieldset directly below the
existing `deleteTorrentFile` switch. It is coupled to `deleteTorrentFile` exactly the way
`startMinimized` is coupled to `openAtLogin`:

- `generalSettingsForm.controls.behavior` gets a new control:
  `deleteTorrentFileOnDuplicate: new FormControl({ value: false, disabled: true }, { nonNullable: true })`.
- In the constructor, subscribe to `behavior.controls.deleteTorrentFile.valueChanges`: when it
  becomes `true`, `enable()` the new control (preserving its current value); when it becomes
  `false`, `setValue(false, { emitEvent: false })` then `disable()` the new control.
- In the `settingsLoaded` load pipeline, after patching the form, enable the new control if the
  loaded `deleteTorrentFile` is `true` (mirroring the `openAtLogin` → enable `startMinimized` on
  load logic).
- In `save()`, add: `if (!settings.behavior.deleteTorrentFile) settings.behavior.deleteTorrentFileOnDuplicate = false;`
  before persisting, mirroring the `startMinimized` guard.

Template: a new `.form-check.form-switch` block, same structure as the existing switches, with a
`bb-popover` describing the setting and noting it requires "Deleting Torrent File" to be enabled.

### 3. Torrent-exists modal

`packages/app/src/app/modals/torrent-exists/torrent-exists.ts` / `.html`

Remove:

- The `showDeleteButton` computed.
- The delete `<button>` in the modal footer.
- The `faTrashCan` icon import/usage (no longer referenced after the button is removed).
- The public `deleteTorrentFile()` method's button-click entry point (logic is kept, see below).

Add:

- A guard field `hasAttemptedDelete = false` (plain instance field, not a signal - purely an
  imperative once-only gate, not read by the template).
- A constructor `effect()` that reads `this.generalSettings()` and `this.originalPath()`; when
  both are available, `hasAttemptedDelete` is `false`, and
  `generalSettings()!.behavior.deleteTorrentFileOnDuplicate` is `true`, it sets
  `hasAttemptedDelete = true` and calls the (private) delete routine.
- The delete routine keeps today's behavior: call `window.bitbutler.torrent.deleteFile({ path })`,
  set `fileDeleted` on success, and show the existing success/danger toasts
  (`components.modals.torrent-exists.toast.deleted` /
  `components.modals.torrent-exists.toast.deleted-title` /
  `components.modals.torrent-exists.toast.delete-failed-title`). On failure, `hasAttemptedDelete`
  stays `true` (no retry - there is no button to retry from anymore).

The `fileDeleted` signal is kept as-is; it no longer drives a `[disabled]` button state, but there's
no other UI depending on it, so it becomes just an internal completion flag (harmless to keep for
clarity/tests).

### 4. i18n

`public/i18n/us.json` / `public/i18n/hu.json`

Remove (now unused): `components.modals.torrent-exists.button.delete-file`.

Add, under `pages.settings.tab.general.general-settings-form.behavior`:

- `delete-torrent-on-duplicate`
  - en: "Delete torrent files when the torrent already exists in the list."
  - hu: "A torrent fájlok törlése, ha a torrent már szerepel a listában."

Add, under `pages.settings.tab.general.popover`:

- `delete-torrent-on-duplicate.title`
  - en: "Delete Torrent File on Duplicate"
  - hu: "Torrent fájl törlése duplikátum esetén"
- `delete-torrent-on-duplicate.description`
  - en: `Automatically delete the .torrent file from your disk when it was already added to the download list. Requires "Deleting Torrent File" to be enabled.`
  - hu: `A .torrent fájl automatikus törlése a lemezről, ha az már hozzá lett adva a letöltési listához. A "Torrent fájl törlése" beállítást igényli.`

(The quoted phrase in the description references the _popover title_ of the parent setting -
`deleting-torrent-file` - matching the existing convention used by `start-minimized`, which
references `open-at-login`'s popover title "Start with System", not its raw switch label.)

### Out of scope

- The existing `deleteTorrentFile` behavior in `add-torrent.ts` (deleting the source `.torrent`
  file after a _successful_ add) is unrelated and untouched.
- No change to how/where `UI_TORRENT_EXISTS` is emitted or handled by
  `ui-command-handler.service.ts` - the modal still opens the same way; only its internal behavior
  changes.

### Testing

- `general-settings.model.ts` / `general-settings.service.spec.ts`: default value, round-trip.
- `general.spec.ts`: enable/disable/force-off coupling for the new control (parent toggled off
  while new control is on → new control becomes `false` and disabled; parent toggled back on →
  new control re-enabled, still `false`; load with parent `true` → new control enabled on load;
  save with parent `false` → new control forced to `false` before persisting).
- `torrent-exists.spec.ts`: button and `showDeleteButton` tests removed; new tests for the
  auto-delete effect (fires once when `deleteTorrentFileOnDuplicate` is on and `originalPath` is
  set; does not fire when the setting is off; does not fire when `originalPath` is null; does not
  fire twice; shows success/failure toasts as before).

## Documentation

No user-guide/docs-site update in this spec per `CLAUDE.md` - that gets planned once the PR is
about to be opened.
