# Torrent Details window rework: header + General tab

## Context

The current Torrent Details modal header shows title, state (colored dot + label), and a hash line. The General tab lays out torrent data across three `bb-fieldset` cards (Title, Transfer, Information) using full-width `bb-section` rows (label | value | copy button).

We're reworking this to match an approved design mockup (`modal-torrentdetails-a.html`) that uses a denser, table-like layout: a slim progress bar with percent/size flanking it above, and stat groups laid out as compact label/value pairs in a bordered card.

Data already updates in real time today via signals fed by `TorrentStoreService` (live torrent list) merged with a 2s-interval properties poll in `TorrentDetailsDataService` — no changes needed to the data layer.

Scope is the modal header and the General tab only. Content/Peers/Trackers tabs (grid components and a file tree) are visually different enough that they're out of scope for this pass.

## Header changes (`torrent-details.html` / `.scss`)

- Remove the hash line block entirely (the `<div class="bb-hash-clamp">` showing `hash: <code>...</code>`).
- Keep the title and the state line (colored dot via `stateVariant()` + translated state label) unchanged.

## New component: `BbProgressCompact`

Location: `packages/app/src/app/components/bb-progress-compact/`

- Standalone component, selector `app-bb-progress-compact`.
- Inputs: `progress` (accepts 0-1 or 0-100, same normalization as `BbProgress`), `torrentState`.
- Reuses `variantForTorrentState()` from `../bb-progress/torrent-state-variant.ts` for state→color mapping (single source of truth, shared with `BbProgress`).
- Renders only the filled track — no text/label inside the bar.
- Visually thinner than `BbProgress` (~4-6px tall vs 18px), fully rounded pill.
- Existing `BbProgress` is left untouched; it's still used by export/import modals, `torrent-exists`, `bb-file-tree`, and the grid's `progress-cell-renderer`.
- Not wired into the torrent list grid as a new column in this pass — that's a documented follow-up, not part of this work.

## General tab restructure (`general.html` / `.ts` / `.scss`)

Progress summary at the top keeps `"{percent}% complete"` on the left and total size on the right, but the bar underneath switches to `BbProgressCompact`.

Four cards, all still `bb-fieldset` containers with uppercase titles:

1. **Details** — Name, Save Path, Remote Path, Local Path (when resolved), Category, Tags. Same full-width `bb-section` row style as today (label | value | copy button, hover-reveal, tooltip-on-overflow for long values). The **State** row is removed here since state now lives only in the header. The error-log banner stays in this card, unchanged.

2. **Transfer** — Time Active, ETA, Download Speed, Upload Speed, Downloaded, Uploaded, Connections, Seeds, Peers, Share Ratio, Download Limit, Upload Limit, Wasted, Reannounce In, Last Activity. Restyled as a strict 2-column grid of compact stat pairs (label left, bold value right, on one row per pair) with row dividers — no copy buttons, matching the mockup's dense table look. This replaces the current 1/2/3-column responsive `bb-section` grid for these fields.

3. **Options** (new card, split out of Transfer) — Auto TMM, Force Start, Sequential Download, First/Last Piece Priority, Super Seeding. Shown as compact on/off chips (icon + label) instead of today's disabled checkboxes, since these don't fit the label/value stat-pair pattern.

4. **Information** — Total Size, Pieces, Created By, Added On, Completed On, Created On, Info Hash v1, Info Hash v2, Comment. Same content and full-width row style as today, unchanged.

All existing popovers (`bb-popover`) on field labels are preserved on their respective fields wherever they exist today.

## Out of scope

- Content, Peers, Trackers tabs.
- Wiring `BbProgressCompact` into the torrent list grid as a new column (future work).
- Any change to how torrent data is fetched/polled — already real-time.

## Testing

- Existing specs for `general.ts`/`general.html` behavior (copy-to-clipboard, error log toggle, tooltips) continue to apply; update selectors/assertions for the new card structure where needed.
- New spec for `BbProgressCompact` covering progress normalization and state→color mapping, mirroring `bb-progress.spec.ts`.
