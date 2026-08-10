# Torrent Details – General Tab Refresh

## Context

The torrent details modal is being reworked to match the "BitButler UI Refresh"
design (design project `BitButler UI Refresh`, reference `modal-torrentdetails-a.html`).
This spec covers the General tab only: the Details, Options, Transfer, and
Information cards inside `packages/app/src/app/modals/torrent-details/general/`.
The footer's split-button dropdowns (Control/Files/Manage/Transfer/Maintenance)
are out of scope except for two specific dropdown-item removals noted below.

## Goals

- Narrow the widest card (Information) from a 3-column layout down to 2, since
  3 columns is too cramped inside a modal tab.
- Remove the copy-to-clipboard affordance and the per-row hover highlight from
  the Details/Information cards.
- Remove bold text from this tab.
- Replace the "pill" toggle-chip display in the Options card with real,
  clickable split buttons that both show and control each option's state.
- Remove the footer dropdown items that become redundant once Options is
  interactive.

## Non-goals

- No changes to the Trackers, Peers, or Content tabs.
- No changes to the footer's Control dropdown (Resume/Pause/Force Resume).
- No changes to the modal header, tab strip, or the Details/Transfer card
  content beyond the cleanup described below.

## Design

### Whole-tab cleanup

- Remove the `.button-container` copy-to-clipboard buttons on the Details and
  Information card rows (name, save path, remote path, local path, category,
  tags, info-hash v1/v2, comment), and the `toClipboard()` method and `faCopy`
  icon import that back them.
- Remove the `:hover`/`:focus-within` background highlight on `.bb-section`
  rows (`bb-hover-list-item-bg`), since it existed to reveal the
  copy-to-clipboard button.
- Change `span.section-value` from `font-weight: 600` to a normal weight —
  nothing on this tab should read as bold.

### Information card: 2-column cap

Change the row grid from `col-12 col-lg-6 col-xl-4` to `col-12 col-lg-6`,
capping it at 2 columns at every breakpoint above mobile.

### Options card: clickable mirrored split-button grid

Replace the `.bb-toggle-grid` of pill chips with a Bootstrap 12-column grid
of real `<button>` elements, laid out in mirrored pairs so that each button's
icon and its info popover sit toward the center of the row:

```
[col-5: Auto TMM ⟩]        [col-1: (i)→]  [col-1: ←(i)]  [col-5: ⟨ Force Start]
[col-5: Sequential DL ⟩]   [col-1: (i)→]  [col-1: ←(i)]  [col-5: ⟨ First/Last Piece Prio]
[col-5: Super Seeding ⟩]   [col-1: (i)→]
```

- Column math: `col-5 + col-1 + col-1 + col-5 = 12`, so a `row` wraps
  automatically after every left/right pair.
- Left-column buttons use `bb-btn-content [position]="'end'"` (icon nearest
  center); right-column buttons use the default `position="start"` (icon
  nearest center on their side).
- Each button's `bb-popover` moves out of the button into its own adjacent
  grid column rather than living inside the button. Left-side popovers use
  `placement="right"` (open toward the row's center); right-side popovers use
  `placement="left"`.
- Button classes: `btn btn-sm btn-split`, plus `btn-link` when the option is
  off and `btn-success` when it's on. Buttons are real, focusable, clickable
  elements — no `disabled` attribute. The button's icon slot keeps the
  existing on/off convention (`faCheck` when on, `faXmark` when off); the
  text is just the option's translated label, no extra description.
- The odd fifth item (Super Seeding) renders alone in the "left" style, on
  its own row with the right half of the row left empty.
- Click handlers call the existing toggle methods on
  `TorrentDetailsActionsService`: `toggleAutoTmm()`,
  `toggleSequentialDownload()`, `toggleFirstLastPiecePrio()`,
  `toggleSuperSeeding()`.
- Add a new `toggleForceStart()` method to `TorrentDetailsActionsService`,
  shaped like `toggleAutoTmm()`: read the current
  `torrent().data.force_start`, call
  `qbService.torrents.setForceStart(serverId, [hash], !current)`, and on
  failure show a danger toast (translation key
  `components.modals.torrent-details.general.toast.toggle-force-start-failed`).
  No success toast — the button's own color change is the visible result,
  consistent with the existing toggle methods and the project's toast rule
  ("skip the toast when the result is already visible in the UI").

### Footer dropdown cleanup

Since the four qBittorrent-backed toggles now have a primary, always-visible
control in the Options card, remove their now-redundant entries from the
footer:

- **Transfer dropdown** (`torrent-details.html`): remove the `toggleSuperSeeding`,
  `toggleSequentialDownload`, and `toggleFirstLastPiecePrio` items and the
  `<div class="dropdown-divider">` that separates them from Transfer
  Limits/Edit Share Limits, leaving just those two items.
- **Maintenance dropdown**: remove the `toggleAutoTmm` item and its preceding
  divider, leaving just Force Recheck and Force Reannounce.
- The Control dropdown's Force Resume action is untouched — it stays because
  it also resumes the torrent, not just because it sets `force_start`.

## Testing

- Existing `general.spec.ts` tests covering the copy-to-clipboard flow and
  the old toggle-chip rendering will need updating to match the new button
  markup and the removal of `toClipboard()`.
- `torrent-details.spec.ts` / footer tests referencing the removed dropdown
  items need updating.
- New coverage: clicking each Options button calls the corresponding
  action-service method; `toggleForceStart()` flips based on current state
  and shows a danger toast on failure.
