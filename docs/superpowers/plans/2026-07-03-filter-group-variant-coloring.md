# Filter Group Variant Coloring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Color the entire filter-group item (label text + hover background) with its `variant`
color, not just the count badge, matching the visual language already used by the right-click
context menu.

**Architecture:** Add a `bb-variant-{variant}` class to each filter-group item button that has a
`variant` set. In `filter-group.scss`, scope new rules under the existing `&:not(.active)` block:
set `color` to the variant's Bootstrap color and override the `--bs-list-group-action-hover-bg`
custom property (already used by this file for hover background) with a `color-mix` tint of that
same color. The active state and the badge's own `text-bg-{variant}` styling are untouched.

**Tech Stack:** Angular 20 (standalone component, signals), SCSS, Vitest (`npm test` /
`packages/app` workspace), Bootstrap 5 CSS custom properties.

## Global Constraints

- Only items with a `variant` set get the new coloring (today: the Status group only -
  `primary`, `secondary`, `success`, `info`, `danger`). Categories/tags/trackers/save-paths have
  no `variant` and must render unchanged.
- Resting (non-hover, non-active) background stays transparent - only text color and hover
  background change.
- Active state is unchanged regardless of variant - always uses `--bb-active-list-item-bg` /
  `--bs-body-color`.
- The count badge's `text-bg-{variant}` styling is unchanged.
- Hover tint uses `color-mix(in srgb, var(--bs-{variant}) 16%, transparent)`, consistent across
  all 5 variants.
- No changes to border color between items.

---

### Task 1: Add variant class to item buttons and variant coloring rules

**Files:**

- Modify: `packages/app/src/app/pages/main/status/filter-group/filter-group.html:52-61` (the
  `@for (item of filteredItems(); ...)` item button)
- Modify: `packages/app/src/app/pages/main/status/filter-group/filter-group.scss:7-32` (the
  `.list-group-item-action` block)
- Test: `packages/app/src/app/pages/main/status/filter-group/filter-group.spec.ts`

**Interfaces:**

- Consumes: existing `FilterItem.variant?: BbProgressVariant` (already defined in
  `filter-group.ts:20-26`); no changes to `FilterItem` or `FilterGroupComponent`'s public API.
- Produces: item buttons rendered with an additional CSS class `bb-variant-{variant}` (e.g.
  `bb-variant-danger`) when `item.variant` is set. No new outputs or inputs.

- [ ] **Step 1: Write the failing tests**

Add this new `describe` block to `filter-group.spec.ts`, right after the existing `describe('item
badge variant', ...)` block (after line 128, before `describe('filteredItems', ...)`):

```typescript
describe('item variant coloring', () => {
  it('should not apply a bb-variant class when an item has no variant', () => {
    fixture.componentRef.setInput('showAll', false);
    fixture.componentRef.setInput('items', [{ key: 'a', label: 'A', count: 1 }]);
    fixture.detectChanges();
    const item: HTMLElement = fixture.nativeElement.querySelector('.list-group-item');
    expect(item.className).not.toContain('bb-variant-');
  });

  it('should apply a bb-variant-{variant} class to the item when a variant is set', () => {
    fixture.componentRef.setInput('showAll', false);
    fixture.componentRef.setInput('items', [{ key: 'a', label: 'A', count: 1, variant: 'danger' }]);
    fixture.detectChanges();
    const item: HTMLElement = fixture.nativeElement.querySelector('.list-group-item');
    expect(item.classList.contains('bb-variant-danger')).toBe(true);
  });

  it('should not apply the class to the "All" item, which never has a variant', () => {
    fixture.componentRef.setInput('showAll', true);
    fixture.componentRef.setInput('items', [
      { key: 'a', label: 'A', count: 1, variant: 'success' },
    ]);
    fixture.detectChanges();
    const items: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.list-group-item'),
    );
    const allItem = items.find((el) => el.textContent?.includes('all'));
    expect(allItem?.className).not.toContain('bb-variant-');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- filter-group`
Expected: FAIL on the 2nd and 3rd new tests (no `bb-variant-*` class exists yet); the 1st new test
passes trivially since no such class exists anywhere yet.

- [ ] **Step 3: Add the variant class in the template**

In `filter-group.html`, the `@for` loop's item button currently reads (lines 52-61):

```html
<button
  type="button"
  class="list-group-item list-group-item-action d-flex align-items-center gap-2"
  [class.active]="activeKey() === item.key"
  (click)="onItemSelected(item.key)"
  [ngbTooltip]="item.label"
  tooltipClass="single-line-tooltip"
  [bbTooltipOverflow]="itemLabel"
  placement="end"
></button>
```

Change it to add an `[ngClass]` binding for the variant:

```html
<button
  type="button"
  class="list-group-item list-group-item-action d-flex align-items-center gap-2"
  [class.active]="activeKey() === item.key"
  [ngClass]="item.variant ? 'bb-variant-' + item.variant : null"
  (click)="onItemSelected(item.key)"
  [ngbTooltip]="item.label"
  tooltipClass="single-line-tooltip"
  [bbTooltipOverflow]="itemLabel"
  placement="end"
></button>
```

(`NgClass` is already imported in `filter-group.ts:1,31` and used elsewhere in this same
template for the badge, so no import changes are needed.)

- [ ] **Step 4: Add the variant coloring rules in SCSS**

In `filter-group.scss`, the `.list-group-item-action` block currently reads (lines 7-32):

```scss
.list-group-item-action {
  border-color: var(--bs-border-color);

  &.active {
    background-color: var(--bb-active-list-item-bg);
    color: var(--bs-body-color);
    border-color: var(--bb-active-list-item-bg) !important;

    .bb-status-badge.bb-status-badge--neutral {
      background-color: var(--bb-accent);
      color: var(--bb-primary-ink);
    }
  }

  &:not(.active) {
    .bb-status-badge.bb-status-badge--neutral {
      background-color: var(--bs-tertiary-bg);
      color: var(--bs-emphasis-color);
    }
  }

  .bb-status-badge {
    --bs-badge-font-weight: 600;
    padding: 0.35rem 0.5rem;
  }
}
```

Replace the `&:not(.active) { ... }` block with:

```scss
&:not(.active) {
  .bb-status-badge.bb-status-badge--neutral {
    background-color: var(--bs-tertiary-bg);
    color: var(--bs-emphasis-color);
  }

  &.bb-variant-primary {
    color: var(--bs-primary);
    --bs-list-group-action-hover-bg: color-mix(in srgb, var(--bs-primary) 16%, transparent);
  }

  &.bb-variant-secondary {
    color: var(--bs-secondary);
    --bs-list-group-action-hover-bg: color-mix(in srgb, var(--bs-secondary) 16%, transparent);
  }

  &.bb-variant-success {
    color: var(--bs-success);
    --bs-list-group-action-hover-bg: color-mix(in srgb, var(--bs-success) 16%, transparent);
  }

  &.bb-variant-info {
    color: var(--bs-info);
    --bs-list-group-action-hover-bg: color-mix(in srgb, var(--bs-info) 16%, transparent);
  }

  &.bb-variant-danger {
    color: var(--bs-danger);
    --bs-list-group-action-hover-bg: color-mix(in srgb, var(--bs-danger) 16%, transparent);
  }
}
```

The rest of the block (`.active { ... }` and `.bb-status-badge { ... }`) stays as-is.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- filter-group`
Expected: PASS - all tests in `filter-group.spec.ts`, including the 3 new ones.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: no errors (zero-warnings policy).

- [ ] **Step 7: Manually verify in the running app**

Run: `npm start`
In the app, open the Status filter group and confirm: each status item's label text is tinted
with its variant color (e.g. "Errored" in red, "Completed" in green), hovering over an item shows
a faint tint of that same color as the background, and selecting an item (making it active) still
shows the existing accent background/text regardless of variant. Confirm Categories/Tags/
Trackers/Save paths items are visually unchanged (still neutral).

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/pages/main/status/filter-group/filter-group.html packages/app/src/app/pages/main/status/filter-group/filter-group.scss packages/app/src/app/pages/main/status/filter-group/filter-group.spec.ts
git commit -m "$(cat <<'EOF'
#202: color entire filter group item by variant, not just the badge

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Post-implementation

- Remove the `docs/superpowers/specs/2026-07-03-filter-group-variant-coloring-design.md` and
  `docs/superpowers/plans/2026-07-03-filter-group-variant-coloring.md` files (and the `docs`
  folder if now empty) in their own commit before opening/merging the PR, per this repo's
  `CLAUDE.md` convention.
