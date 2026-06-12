# BB File Tree: Self-Contained Height & Torrent Details Tab Fix

## Problem

The torrent-details modal currently shows no tab content at all (general,
trackers, peers, content - all blank). This is a regression introduced by
`#153` commit `1c1b4c7`.

**Root cause:** `.bb-tab-panel--active` (torrent-details.scss) no longer sets
`position`, so it inherits `position: absolute; inset: 0;` from the base
`.bb-tab-panel` rule. An absolutely-positioned element contributes zero height
to its parent. The new flex chain added in that commit
(`.modal-body { flex: 1 }` -> `.bb-tab-panels { flex: 1; min-height: 0 }` ->
`.bb-tab-panel--active`) therefore has no in-flow content anywhere.
Bootstrap's `.modal-dialog-scrollable .modal-content { max-height: 100% }`
only clamps height when content would overflow it - it does not force a
height when content is smaller. With the active panel contributing 0px, the
whole chain collapses to ~0px, so every tab's content renders into a 0px box.

**Underlying design issue:** `bb-file-tree`'s CDK virtual-scroll-viewport
needs a definite height on `:host` to do its scroll math. Today that height
comes entirely from `flex: 1; min-height: 0` resolving against an ancestor
chain that consumers must build correctly, end to end, from the component up
to a definite-height container. That's fragile (as this regression shows) and
means every new consumer has to "hack" its layout to cooperate.

## Goals

- `bb-file-tree` sizes itself by default (a definite height on `:host`), so
  dropping `<app-bb-file-tree>` into any container - a modal tab, a fieldset -
  just works without consumer-side flex-chain plumbing.
- Consumers can still override the size via a CSS custom property if a
  context needs something different, without re-introducing flex hacks.
- Fix the torrent-details "blank tabs" regression.
- Remove the now-unnecessary flex plumbing added in `1c1b4c7` for
  `content.scss` and `add-torrent.scss`/`.html`.

## Design

### 1. `bb-file-tree.scss` - self-contained height

```scss
:host {
  height: var(--bb-file-tree-height, min(60vh, 480px));
  display: flex;
  flex-direction: column;
  --bb-tree-indent: 1.5rem;
  color: var(--bs-body-color);
}
```

`.bb-file-tree` (the `cdk-virtual-scroll-viewport`) keeps its existing
`flex: 1; min-height: 0`, which now resolves against `:host`'s definite
height instead of an inherited one. A consumer that wants a different size
for its context overrides the custom property:

```scss
app-bb-file-tree {
  --bb-file-tree-height: 40vh;
}
```

`min(60vh, 480px)` was chosen so the tree never dominates a small window
(capped at 60% of viewport height) nor grows excessively on very tall windows
(capped at 480px, ~13 rows at the current `itemSize="36"`).

### 2. `torrent-details.scss` - revert the regression

Revert `.modal-body`, `.bb-tab-panels`, and `.bb-tab-panel--active` to their
pre-`#153` state. Specifically, `.bb-tab-panel--active` goes back to
`position: relative; overflow: visible;` so it contributes its natural height
to `.bb-tab-panels` again. The `.modal-body`/`.bb-tab-panels` flex additions
from `1c1b4c7` are removed (no longer needed once panels are in-flow).
Bootstrap's built-in `.modal-dialog-scrollable .modal-body { overflow-y: auto
}` (applied globally because the modal is opened with `scrollable: true`)
provides the outer scroll fallback for all tabs, as it did before `#153`.

### 3. `content.scss` - simplify

Revert to empty. The flex-fill rules added in `1c1b4c7`
(`:host { flex: 1; min-height: 0 }`, `app-bb-file-tree { flex: 1; min-height:
0 }`) are no longer needed - `bb-file-tree` brings its own height now, and
`.bb-tab-panel--active` is back to a normal in-flow block.

### 4. `add-torrent.scss` / `.html` - simplify

Remove the `.bb-fieldset--file-tree` modifier class from the fieldset in
`add-torrent.html` (back to plain `class="bb-fieldset"`) and delete the
corresponding SCSS rule (`max-height: 50vh` + flex child rule). The tree's
own default height (`min(60vh, 480px)`) applies here too, and the modal's
existing `scrollable: true` handles outer overflow if the form content plus
tree exceeds the modal's max height.

## Testing

- No unit test changes expected - this is pure layout/CSS; existing specs for
  `bb-file-tree`, `content`, and `add-torrent` continue to pass unchanged.
- Manual verification (via the running app):
  - Open torrent details: all four tabs (General, Trackers, Peers, Content)
    render their content.
  - Content tab: file tree renders, virtual scroll works for a torrent with
    many files, edit mode (rename/priority) still works.
  - Add-torrent: file tree renders inside the fieldset at a reasonable size,
    modal scrolls as a whole if needed.

## Risks / trade-offs

- A fixed default height means the tree won't perfectly "fit" every window
  size - there may be a little empty space below it in very tall modals, or
  it may push a short window's modal into its outer scroll. This is
  acceptable: it's predictable, self-contained, and tunable per-consumer via
  `--bb-file-tree-height` without new layout plumbing.
