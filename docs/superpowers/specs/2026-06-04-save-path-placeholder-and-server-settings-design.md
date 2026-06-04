---
name: save-path-placeholder-and-server-settings
description: Show qBittorrent default path as placeholder (not value) in add-torrent; make server settings remote path clearable with default fallback on save.
metadata:
  type: project
---

# Save Path Placeholder & Server Settings Remote Path Design

## Scope

Two focused changes to how `save-path-select` is used in add-torrent and server settings.

## Change 1 - Add Torrent: default path as placeholder only

### Problem

In `add-torrent.ts ngOnInit()` (lines 185-192), when `settings.savepath` is null or empty the
component fetches the qBittorrent default path and sets it as the form value. This pre-fills the
field with the default, giving the appearance that the user must supply a path.

### Desired behavior

- The `savepath` form control stays `null` when the user has no saved preference.
- `save-path-select` already fetches and shows `defaultPath` as placeholder text - no pre-fill needed.
- On submit, `raw.savepath?.trim() || undefined` already converts `null` to `undefined`, so
  qBittorrent uses its own configured default. No submit-side change required.

### Implementation

Remove the block in `add-torrent.ts ngOnInit()` that fetches `getAppPreferences` and assigns
`settings.savepath = prefs.save_path`. Everything else is unchanged.

## Change 2 - Server Settings: clearable remote path with default fallback

### Problem

The `save-path-select` bound to `formControlName="remote"` in `server.html`:

- Has no `[clearable]` binding, so the user cannot clear a previously saved path.
- When the user leaves the field empty and saves, an empty string is persisted. On next load the
  field shows empty with no placeholder context, which is confusing.

### Desired behavior

- The remote path field is clearable (built-in X button via ng-select when a value is selected).
- `save-path-select` already fetches `defaultPath` from `getAppPreferences` and shows it as
  placeholder text - so a cleared/empty field communicates what will be used.
- When saving, if `remote` is empty/null, resolve it to the qBittorrent default path before
  persisting. On next load, `writeValue(defaultPath)` shows the path as a selected value (not
  placeholder), keeping the X button visible and the state unambiguous.

### Implementation

**`server.html`** - add `[clearable]="true"` to the `app-save-path-select` for the remote field.

**`server.ts`** - inject `QbService`. In the `settings$` pipe (where the server ID already drives
a reload), fetch `getAppPreferences` and store the result in a `defaultRemotePath` signal/property.
In the `save()` method, iterate `pathMappings` and for each entry where `remote` is falsy, replace
it with `defaultRemotePath` before passing to `serverSettingsService.save()`.

## Out of scope

- General settings save-path previews - the built-in ng-select X button behaves correctly
  (visible when a value is selected, hidden when empty). No changes needed.
- Set-torrent-location (context menu modal) - already works correctly, no changes.
- The `save-path-select` component itself requires no new inputs or internal changes.
