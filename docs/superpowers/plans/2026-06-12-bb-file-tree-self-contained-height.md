# BB File Tree Self-Contained Height Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `bb-file-tree` a self-contained default height (via a CSS custom
property) so it works in any host container without consumer flex-chain
plumbing, and fix the torrent-details "blank tabs" regression from `#153`.

**Architecture:** Pure CSS/SCSS changes across four files. `bb-file-tree`'s
`:host` gets a definite `height` (`var(--bb-file-tree-height, min(60vh,
480px))`), letting its internal `cdk-virtual-scroll-viewport`
(`flex: 1; min-height: 0`) size correctly anywhere. `torrent-details.scss` is
reverted to its pre-`#153` tab-panel positioning (the actual bug fix).
`content.scss` and `add-torrent.scss`/`.html` drop the now-unnecessary
flex-fill plumbing added in `1c1b4c7`.

**Tech Stack:** Angular 20 (standalone components, SCSS), `@angular/cdk/scrolling`.

**Reference design:** `docs/superpowers/specs/2026-06-12-bb-file-tree-self-contained-height-design.md`

---

### Task 1: Self-contained height for `bb-file-tree`

**Files:**

- Modify: `packages/app/src/app/components/bb-file-tree/bb-file-tree.scss:1-6`

- [ ] **Step 1: Edit the `:host` rule**

Current content (lines 1-6):

```scss
:host {
  display: flex;
  flex-direction: column;
  --bb-tree-indent: 1.5rem;
  color: var(--bs-body-color);
}
```

Replace with:

```scss
:host {
  height: var(--bb-file-tree-height, min(60vh, 480px));
  display: flex;
  flex-direction: column;
  --bb-tree-indent: 1.5rem;
  color: var(--bs-body-color);
}
```

No other rules in this file change - `.bb-file-tree` (the
`cdk-virtual-scroll-viewport`) already has `flex: 1; min-height: 0;`, which
now resolves against `:host`'s new definite height.

- [ ] **Step 2: Commit**

```bash
git add packages/app/src/app/components/bb-file-tree/bb-file-tree.scss
git commit -m "$(cat <<'EOF'
#153: give bb-file-tree a self-contained default height

:host now sets an actual height (var(--bb-file-tree-height, min(60vh,
480px))) instead of depending on an ancestor flex chain to provide one.
Consumers can override --bb-file-tree-height if a different size is
needed; the cdk-virtual-scroll-viewport's flex:1/min-height:0 now
resolves against this definite height anywhere the component is placed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Fix blank torrent-details tabs (revert `#153` regression)

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details.scss`

- [ ] **Step 1: Replace the file contents**

Current content:

```scss
.modal-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.bb-tab-panels {
  position: relative;
  flex: 1;
  min-height: 0;
}

.bb-tab-panel {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
  transition: opacity 0.2s ease;

  &--active {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    opacity: 1;
    pointer-events: auto;
  }
}
```

Replace with (this is the pre-`#153` version - `.bb-tab-panel--active` goes
back to being in-flow so it contributes its natural height to
`.bb-tab-panels`/`.modal-body`/`.modal-content`):

```scss
.bb-tab-panels {
  position: relative;
}

.bb-tab-panel {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
  transition: opacity 0.2s ease;

  &--active {
    position: relative;
    overflow: visible;
    opacity: 1;
    pointer-events: auto;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/torrent-details.scss
git commit -m "$(cat <<'EOF'
#153: fix blank torrent-details tabs

.bb-tab-panel--active had inherited position: absolute; inset: 0; from
the base .bb-tab-panel rule (only display/overflow were overridden),
so it contributed zero height to .bb-tab-panels. With no in-flow
content anywhere in the .modal-body -> .bb-tab-panels -> .bb-tab-panel
chain, .modal-content's natural height collapsed to ~0 and every tab
rendered into a 0px box.

Revert to the pre-#153 positioning: .bb-tab-panel--active is in-flow
again (position: relative; overflow: visible), so it contributes its
natural height. Bootstrap's .modal-dialog-scrollable .modal-body {
overflow-y: auto } (from scrollable: true) handles the outer scroll
fallback as before.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Remove now-unnecessary flex sizing from the Content tab

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/content/content.scss`

- [ ] **Step 1: Empty the file**

Current content:

```scss
:host {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

app-bb-file-tree {
  flex: 1;
  min-height: 0;
}
```

Replace with an empty file (0 bytes - this matches its pre-`#153` state).
`content.ts` still references `styleUrl: './content.scss'`, so keep the
(now empty) file in place.

- [ ] **Step 2: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/content/content.scss
git commit -m "$(cat <<'EOF'
#153: remove now-unnecessary flex sizing from content tab

bb-file-tree now provides its own definite height and
.bb-tab-panel--active is back to a normal in-flow block (see previous
commit), so the flex-fill rules added for #153 are no longer needed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Remove now-unnecessary fieldset sizing from add-torrent

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/add-torrent.html`
- Modify: `packages/app/src/app/components/add-torrent/add-torrent.scss`

- [ ] **Step 1: Drop the `bb-fieldset--file-tree` modifier class**

In `add-torrent.html`, find:

```html
      <fieldset class="bb-fieldset bb-fieldset--file-tree">
        <legend>{{ 'components.add-torrent.label.files' | translate }}</legend>

        <app-bb-file-tree
```

Replace the first line with:

```html
<fieldset class="bb-fieldset"></fieldset>
```

(leave the `<legend>` and `<app-bb-file-tree>` lines unchanged).

- [ ] **Step 2: Empty `add-torrent.scss`**

Current content:

```scss
.bb-fieldset--file-tree {
  display: flex;
  flex-direction: column;
  max-height: 50vh;

  app-bb-file-tree {
    flex: 1;
    min-height: 0;
  }
}
```

Replace with an empty file (0 bytes - this matches its pre-`#153` state).
`add-torrent.ts` still references `styleUrl: './add-torrent.scss'`, so keep
the (now empty) file in place.

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/components/add-torrent/add-torrent.html packages/app/src/app/components/add-torrent/add-torrent.scss
git commit -m "$(cat <<'EOF'
#153: remove now-unnecessary file-tree fieldset sizing in add-torrent

bb-file-tree now sizes itself via its own default height
(min(60vh, 480px)), so the .bb-fieldset--file-tree wrapper added for
#153 (max-height + flex child rule) is no longer needed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Verify

**Files:** none (verification only)

- [ ] **Step 1: Run the app test suite**

Run: `npm test --workspace=packages/app`

Expected: all existing suites pass, including
`bb-file-tree.spec.ts`, `content.spec.ts`, `add-torrent.spec.ts`, and
`torrent-details.spec.ts` (no test changes were made - this confirms the
SCSS edits didn't break component compilation).

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: passes with zero warnings (the `add-torrent.html` class-name edit
is the only markup change).

- [ ] **Step 3: Manual verification in the running app**

Use the project's `run` skill to launch the app, then check:

- Open a torrent's details modal: **General**, **Trackers**, **Peers**, and
  **Content** tabs all render their content (previously all four were blank).
- **Content** tab: the file tree renders with its header/stats bar, the list
  is scrollable via `cdk-virtual-scroll-viewport` for a torrent with many
  files, and edit mode (rename a file/folder, change priority, Save/Cancel)
  still works.
- Open **Add Torrent** with a torrent/magnet that has multiple files: the file
  tree renders at a reasonable size inside its fieldset (not collapsed, not
  oversized), and the modal scrolls as a whole if the form content plus tree
  exceeds the modal's height.

If any of these look wrong, note which file/rule needs adjusting (e.g. tune
`--bb-file-tree-height` for the add-torrent context) before considering this
plan complete.
