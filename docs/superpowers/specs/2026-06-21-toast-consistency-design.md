# Toast Consistency Design

## Problem

Toasts across the app don't follow one convention. Titles sometimes name the
calling component ("Manage Tags"), sometimes just the severity level
("Success", "Error"), and sometimes describe the actual outcome ("Failed to
relocate torrent!"). Casing and punctuation vary (Title Case vs sentence
case, trailing `!`, trailing `.`, no punctuation). Several action paths -
mainly the grid context menu and a few shared modals - have no toast
feedback at all, including some that silently swallow errors.

This spec defines one convention for every toast's title and message, lists
every existing call site that needs to change to match it, and lists the
toast coverage gaps to close in the same pass.

## Goals

- One rule for what a toast title says and how it's formatted, applied
  everywhere.
- One rule for what a toast message contains, given the title already states
  the outcome.
- Close real toast/error-handling gaps found during the audit (silent
  failures, a modal that closes on error, missing feedback for grid actions).
- Record the convention in `CLAUDE.md` so new toasts follow it without
  rediscovery.

## Non-goals

- The debug toast-preview menu (`menu-bar-command-handler.service.ts`,
  `debug.toast.*` cases) - its hardcoded labels are the thing being
  demonstrated, left as-is.
- Reworking the `ToastService` API itself (`showHtml`/`showText` and the
  level wrappers stay as they are), aside from removing the redundant
  `.error()` wrapper noted under Minor cleanup.
- Localizing into `hu.json` as part of this change - only `us.json` keys are
  specified here; the existing translation workflow handles the Hungarian
  file separately.

## The convention

**Title** - every _terminal_ toast (a success confirmation or an error) gets
a short, specific title describing what happened, not who triggered it or
its severity level:

- Headline-style Title Case (capitalize major words, lowercase short
  articles/prepositions/conjunctions unless they're the first word - matches
  existing app conventions like "Check for Updates"). No trailing
  punctuation.
- Success: `<Noun> <past-tense verb>`, e.g. "Tag Added", "Server Deleted",
  "Settings Saved", "Torrent Resumed".
- Error: `Failed to <verb> <noun>`, e.g. "Failed to Resume Torrent",
  "Failed to Add Tag", "Failed to Connect".

**Message** - contains the variable detail, not a restatement of the title:

- If there's a discrete detail (a name, a path, raw backend error text), the
  message is that detail alone. Names and paths are quoted (`"movies"`),
  matching existing dialog conventions; raw error text is shown as returned,
  unquoted, no added punctuation.
- If there's no detail (e.g. a plain "settings saved" confirmation), the
  message is one short, complete, sentence-case confirmation sentence
  ending in a period. Every terminal toast needs a non-empty message (the
  `ToastService` API requires one) - "no detail" means "use a confirmation
  sentence," never "leave it blank."
- "Raw caught error" anywhere in this spec means `error?.message ?? String(error)`,
  matching the pattern already used in `general.ts` and `qb.service.ts`.
- A bulk action's in-progress/result message that needs to cover both a
  single torrent and many uses the same `{{count}} torrent(s)` style already
  established in `manage-tags.ts` (`{{count}} tag(s) added.`) rather than
  separate singular/plural keys.

**Transient/in-progress toasts are exempt.** An action that's been issued
but hasn't resolved yet (e.g. "Resuming the torrent…") keeps today's
behavior: default level title ("Info"), full descriptive sentence ending in
an ellipsis as the message. This already-correct pattern lives in
`general.ts` and is not a terminal outcome, so the new title rule doesn't
apply to it.

**Debug toast-preview menu is out of scope**, per Non-goals.

## i18n key naming

Extend the `-title` suffix convention already used in `qb.service.ts` /
`torrent-command-handler.service.ts` (`delete-failed-title`,
`check-failed-title`) to every toast that needs a specific title, success
included (`added-title`, `deleted-title`, `saved-title`, etc.), so a title
key and its message key are always siblings under the same `toast`
namespace. Where the message is just the raw caught error or a quoted
variable (no static text), no message key is needed - the call site passes
the value directly, matching the existing pattern in `general.ts` and
`qb.service.ts`.

## Per-file migration

Casing/punctuation-only fixes (structure is already title = outcome,
message = detail):

| File                                                             | Key                                                               | Current value                 | New value                     |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------- | ----------------------------- |
| `pages/login/login.ts`                                           | `pages.login.error.connection-failed`                             | "Connection failed."          | "Connection Failed"           |
| `app.ts`                                                         | `app.success.finished-downloading`                                | "Download Finished!"          | "Download Finished"           |
| `components/modals/rename-torrent/rename-torrent.ts`             | `components.modals.rename-torrent.error.failed-to-rename`         | "Failed to rename torrent"    | "Failed to Rename Torrent"    |
| `components/modals/set-torrent-location/set-torrent-location.ts` | `components.modals.set-torrent-location.error.failed-to-relocate` | "Failed to relocate torrent!" | "Failed to Relocate Torrent"  |
| `pages/main/grid/context-menu/grid-context-menu.service.ts`      | `pages.main.grid.context-menu.toast.export-failed-title`          | "Export failed"               | "Export Failed"               |
| `services/torrent-command-handler.service.ts`                    | `services.torrent-command-handler.error.delete-failed-title`      | "Failed to delete torrent(s)" | "Failed to Delete Torrent(s)" |

Already-correct titles, no change needed: `services.qb.error.request-failed-title`
("Request Failed"), `services.qb.warning.connection-retry-title` ("Connection
Issue"), `services.update-command-handler.error.check-failed-title` ("Update
Check Failed").

`components/modals/torrent-details/general/general.ts` toast keys (lines
486-509 of `us.json`) are sentence-case action descriptions used as
_messages_, not titles, for the transient info toasts (e.g. "Resuming the
torrent…") - those are correct as-is per the transient-toast exemption. Their
paired `*-failed` keys are currently used as titles in sentence case (e.g.
"Failed to resume torrent") and need Title Case: "Failed to Resume Torrent",
"Failed to Pause Torrent", "Failed to Force Resume Torrent", "Failed to Clear
Download Limit", "Failed to Clear Upload Limit", "Failed to Clear Ratio
Limit", "Failed to Clear Seeding Time Limit", "Failed to Clear Inactive
Seeding Time Limit", "Failed to Reannounce Torrent", "Failed to Remove
Category", "Failed to Remove All Tags". `local-path-failed` ("Failed to
resolve local path!") becomes "Failed to Resolve Local Path".

Structural fixes (title was the component name or a generic level word;
message either restated the outcome or used a static string instead of the
real error):

| File                                                       | Action          | Current title                    | Current message                        | New title                         | New message                                                            |
| ---------------------------------------------------------- | --------------- | -------------------------------- | -------------------------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| `components/modals/manage-tags/manage-tags.ts`             | add (single)    | "Manage Tags"                    | `Tag "x" has been added.`              | "Tag Added"                       | `"x"`                                                                  |
| same                                                       | add (batch)     | "Manage Tags"                    | `N tag(s) added.`                      | "Tags Added"                      | `N tag(s)`                                                             |
| same                                                       | add failed      | "Manage Tags"                    | "Failed to add tag(s)." (static)       | "Failed to Add Tag(s)"            | raw caught error                                                       |
| same                                                       | delete          | "Manage Tags"                    | `Tag "x" has been deleted.`            | "Tag Deleted"                     | `"x"`                                                                  |
| same                                                       | delete failed   | "Manage Tags"                    | `Failed to delete tag "x".` (static)   | "Failed to Delete Tag"            | raw caught error                                                       |
| `components/modals/manage-categories/manage-categories.ts` | add             | "Manage Categories"              | `Category "x" has been added.`         | "Category Added"                  | `"x"`                                                                  |
| same                                                       | add failed      | "Manage Categories"              | static "Failed to add category..."     | "Failed to Add Category"          | raw caught error                                                       |
| same                                                       | edit            | "Manage Categories"              | `Category "x" has been updated.`       | "Category Updated"                | `"x"`                                                                  |
| same                                                       | edit failed     | "Manage Categories"              | static                                 | "Failed to Update Category"       | raw caught error                                                       |
| same                                                       | delete          | "Manage Categories"              | `Category "x" has been deleted.`       | "Category Deleted"                | `"x"`                                                                  |
| same                                                       | delete failed   | "Manage Categories"              | static                                 | "Failed to Delete Category"       | raw caught error                                                       |
| `components/modals/torrent-exists/torrent-exists.ts`       | file deleted    | "Torrent Exists"                 | "Torrent file has been deleted."       | "Torrent File Deleted"            | "The torrent file has been removed from disk."                         |
| `services/server-command-handler.service.ts`               | server added    | default "Success"                | `Server "x" added!`                    | "Server Added"                    | `"x"`                                                                  |
| same                                                       | added (no name) | default "Success"                | "Server added!"                        | "Server Added"                    | short confirmation: "The server has been added."                       |
| same                                                       | updated         | default "Info"                   | `Server "x" updated!`                  | "Server Updated"                  | `"x"`                                                                  |
| same                                                       | deleted         | default "Info"                   | `Server "x" deleted.`                  | "Server Deleted"                  | `"x"`                                                                  |
| `pages/settings/settings.ts`                               | saved           | default "Success"                | "Settings Saved"                       | "Settings Saved"                  | "Your changes have been saved."                                        |
| `pages/qb-settings/qb-settings.ts`                         | saved           | default "Success"                | "qBittorrent Settings Saved"           | "qBittorrent Settings Saved"      | "Your changes have been saved."                                        |
| same                                                       | save failed     | default "Error" (via `.error()`) | "Failed to save settings."             | "Failed to Save Settings"         | raw caught error if available, else "Your changes could not be saved." |
| `services/update-command-handler.service.ts`               | up to date      | default "Success"                | "You are on the latest version!"       | "Up to Date"                      | "You're running the latest version."                                   |
| `components/modals/torrent-details/content/content.ts`     | load failed     | default "Error"                  | "Failed to load torrent contents!"     | "Failed to Load Torrent Contents" | raw caught error                                                       |
| same                                                       | save failed     | default "Error"                  | "Failed to save changes!"              | "Failed to Save Changes"          | raw caught error                                                       |
| `services/ui-command-handler.service.ts`                   | showing file    | default "Info"                   | `Showing file in folder {{path}}`      | "Showing File"                    | `{{path}}`                                                             |
| same                                                       | opening folder  | default "Info"                   | `Opening folder {{path}}`              | "Opening Folder"                  | `{{path}}`                                                             |
| same                                                       | server switch   | default "Info"                   | `Switching to {{name}}`                | kept as transient (see below)     | unchanged                                                              |
| same                                                       | connect failed  | default "Error"                  | `Failed to connect to {{name}}!`       | "Failed to Connect"               | `{{name}}`                                                             |
| `services/transfer-limit-command-handler.service.ts`       | alt limit on    | default "Info"                   | "Turning alternative speed limit on."  | "Alternative Speed Limit On"      | "Alternative speed limits are now active."                             |
| same                                                       | alt limit off   | default "Info"                   | "Turning alternative speed limit off." | "Alternative Speed Limit Off"     | "Alternative speed limits are no longer active."                       |

`UI_SERVER_EDITOR` "switching server" toast stays a transient toast (the
follow-up app-loader modal is the actual progress indicator) - only its
sibling "failed to connect" error gets the new specific-title treatment.

`qb.service.ts` connection-retry currently calls `.danger()` although its
i18n keys live under a `warning.*` namespace and the title is "Connection
Issue" - change the call to `.warning()` so the toast's visual severity
matches its content. No text changes needed there.

## Context menu and shared modal toast coverage

The audit found four shared modals with no toast feedback at all, and a
torrent command handler with no success feedback and, for several actions,
no error handling at all. These are used by both the torrent-details general
tab and the grid context menu, so fixing them once covers both surfaces.

**Shared modals** - `SetTorrentTags`, `SetTorrentCategory`, `ShareLimit`,
`TransferLimit`. Each currently only `console.error`s on failure and closes
silently on success. Add a danger toast in each catch block: a specific
title ("Failed to Set Torrent Tags", "Failed to Set Category", "Failed to
Set Share Limits", "Failed to Set Transfer Limits") and the raw caught error
as the message. No success toast - closing the modal already confirms
success, matching `rename-torrent.ts` / `set-torrent-location.ts`.

`TransferLimit.handleSubmit` additionally has a real bug: `activeModal.close()`
runs in the `finally` block, so the modal closes even when the save fails,
hiding the failure entirely. Move the close call into the `try` block, right
after the awaited calls succeed.

**`TorrentCommandHandlerService`** (backs the grid context menu's start,
stop, force-resume, recheck, reannounce, super-seeding, auto-tmm, and queue
actions):

- `handlePause`, `handleResume`, `handleForceResume`, `handleRecheck`,
  `handleReannounce`: adopt the `general.ts` pattern - an info toast when the
  action starts (e.g. "Resuming {{count}} torrent(s)…", per the `{{count}}
torrent(s)` style defined above) and a danger toast with a specific
  "Failed to X" title plus the raw error on failure. `handleReannounce` and
  `handleRecheck` need new try/catch blocks (currently have none). New i18n
  keys are needed under `services.torrent-command-handler.toast.*` for each
  action's in-progress message and failure title.
- `handleSuperSeeding`, `handleAutoTmm`: no info toast (the menu checkmark
  already confirms the new state instantly) - just wrap in try/catch and add
  a danger toast with a specific title on failure. Currently these methods
  have no error handling of any kind, so a failed call is a silent,
  unhandled promise rejection.
- `handleQueueMoveTop/Up/Down/Bottom`: no info toast (the row visibly moves)
  - upgrade the existing `console.error`-only catch blocks to also show a
    danger toast with a specific title ("Failed to Move Torrent(s) to Top of
    Queue", etc.) and the raw error.
- `handleDelete`: keep as-is structurally (error toast only, no success
  toast - the torrent disappearing from the grid is the confirmation,
  matching `general.ts`'s delete flow). Already covered by the title-casing
  fix above.
- `handlePauseAll` / `handleResumeAll`: same treatment as pause/resume -
  info toast on start ("Pausing all torrents…" / "Resuming all torrents…"),
  danger toast with specific title on failure.

**Grid context-menu clipboard actions** (copy name, magnet link, info hash,
save path, copy as JSON) currently give no feedback, while the equivalent
single-field copy in `general.ts` already shows a confirmation toast. Add
the same info confirmation to all five: a new sibling key
`pages.main.grid.context-menu.toast.copied-to-clipboard` (same
`Copied {{field}} to clipboard.` shape as `general.ts`'s key, kept as its
own key in this component's namespace rather than shared, matching how every
other component owns its own i18n subtree) with default "Info" title, since
this is a momentary confirmation rather than a terminal success/failure
outcome. The `{{field}}` value reuses each action's existing
singular/plural label switching (`isMulti`) already in the file, e.g. "Name"
vs "Names", "Magnet Link" vs "Magnet Links".

## Minor cleanup found during the audit

- `pages/settings/settings.ts`'s `onSave()` has no try/catch at all (unlike
  `qb-settings.ts`, which does) - a failed `saveAll()` call is silently
  swallowed with no feedback and the modal still closes. Wrap it the same
  way `qb-settings.ts` does, with the new "Failed to Save Settings" title.
- `ToastService.error()` and `ToastService.danger()` are identical
  (`type: 'danger'`, same default title key) - `qb-settings.ts` is the only
  caller of `.error()`. Switch it to `.danger()` and remove the redundant
  `.error()` method.
- `torrent-exists.ts`'s `deleteTorrentFile()` has no try/catch around
  `window.bitbutler.torrent.deleteFile()` - wrap it and add a danger toast
  with a specific "Failed to Delete Torrent File" title on failure, for
  parity with every other file-affecting action in the app.

## CLAUDE.md addition

Add a new section documenting the convention so future toast call sites
follow it without rediscovery:

```markdown
## Toasts

- Toast title = a short, specific, Title-Case description of the outcome
  ("Tag Added", "Failed to Resume Torrent") - never the calling component's
  name, never just the severity level.
- Toast message = the variable detail only (a quoted name/path, or the raw
  caught error), or, if there's no detail, one short sentence-case
  confirmation ending in a period. Never restate what the title already
  says.
- Exception: a transient "action in progress" toast (e.g. "Resuming the
  torrent…") keeps the default level title and a full sentence as its
  message - this rule applies to terminal success/error toasts only.
- Skip the toast entirely for actions whose result is already visible
  in the UI (e.g. a grid row reordering, a checkbox toggling) - add one
  only when something happened that the user can't otherwise see, or when
  it can fail.
```

## Out of scope

- The debug toast-preview menu (`menu-bar-command-handler.service.ts`).
- `hu.json` translations - update alongside `us.json` per the existing
  translation workflow, not specified key-by-key here.
- Any `ToastService` API changes beyond removing the redundant `.error()`
  method.
